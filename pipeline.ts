import { prisma } from "../db";
import { chunkPages, type RawPage } from "./chunk";
import { embedText } from "./embeddings";
import { vectorUpsert } from "./vectorStore";

export async function clearResourceIndex(resourceId:string){await prisma.document.deleteMany({where:{resourceId}})}
export async function processResource(resourceId:string,extractPages:(key:string)=>Promise<RawPage[]>) {
 const resource=await prisma.resource.findUniqueOrThrow({where:{id:resourceId}});
 try{
  await clearResourceIndex(resourceId);
  await prisma.resource.update({where:{id:resourceId},data:{status:'PROCESSING',progress:10,errorMessage:null}});
  const pages=await extractPages(resource.fileUrl);
  const meaningful=pages.filter(p=>p.text.trim().length>20).length;
  const ocrApplied=pages.some(p=>p.ocrApplied);
  const ocrQuality=pages.length===0?'poor':meaningful/pages.length>=0.9?'good':meaningful/pages.length>=0.6?'fair':'poor';
  await prisma.resource.update({where:{id:resourceId},data:{status:'INDEXING',progress:45,pageCount:pages.length,ocrApplied,ocrQuality}});
  const chunks=chunkPages(pages.filter(p=>p.text.trim()));
  const document=await prisma.document.create({data:{resourceId,rawText:pages.map(p=>p.text).join('\n\n'),chapters:buildChapterTree(pages)}});
  let done=0;
  for(const chunk of chunks){
   const row=await prisma.chunk.create({data:{documentId:document.id,content:chunk.content,chapter:chunk.chapter,section:chunk.section,pdfPage:chunk.pdfPage,printedPage:chunk.printedPage}});
   const embedding=await embedText(chunk.content); await vectorUpsert({chunkId:row.id,resourceId,embedding});
   done++; await prisma.resource.update({where:{id:resourceId},data:{progress:chunks.length?45+Math.round(done/chunks.length*50):95}});
  }
  await prisma.resource.update({where:{id:resourceId},data:{status:'READY',progress:100,errorMessage:null}});
 }catch(err){try{await prisma.resource.update({where:{id:resourceId},data:{status:'FAILED',errorMessage:(err instanceof Error?err.message:'Unknown processing error').slice(0,1000)}})}catch{} throw err}
}
function buildChapterTree(pages:RawPage[]){const chapters=new Map<string,number[]>();for(const p of pages){if(!p.chapter)continue;const list=chapters.get(p.chapter)??[];list.push(p.pageNumber);chapters.set(p.chapter,list)}return Object.fromEntries(chapters)}
