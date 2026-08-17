import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const LOCAL_ROOT = path.resolve(process.env.NEVORA_STORAGE_DIR || path.join(process.cwd(), "storage"));

function hasS3Config() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_REGION &&
      process.env.S3_ENDPOINT
  );
}

function assertSafeKey(key: string) {
  if (!key || key.startsWith("/") || key.includes("\\") || key.split("/").some((part) => part === ".." || part === ".")) throw new Error("Unsafe storage key.");
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/%2F/g, "/");
}

function hmac(key: Buffer | string, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function sha256(value: Buffer | string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function s3Url(key: string) {
  const endpoint = process.env.S3_ENDPOINT!.replace(/\/+$/, "");
  return `${endpoint}/${encodePathSegment(process.env.S3_BUCKET!)}/${encodePathSegment(key)}`;
}

function s3Authorization(method: string, key: string, payloadHash: string, date: Date) {
  const region = process.env.S3_REGION!;
  const service = "s3";
  const accessKey = process.env.S3_ACCESS_KEY_ID!;
  const secretKey = process.env.S3_SECRET_ACCESS_KEY!;
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const shortDate = amzDate.slice(0, 8);
  const url = new URL(s3Url(key));
  const canonicalUri = url.pathname;
  const host = url.host;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${shortDate}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${secretKey}`, shortDate);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return {
    url: url.toString(),
    headers: {
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

function objectKey(resourceId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^[-.]+/, "") || "resource.pdf";
  return `resources/${resourceId}/${safeName}`;
}

export async function putPdf(resourceId: string, fileName: string, bytes: Buffer) {
  const key = objectKey(resourceId, fileName);
  assertSafeKey(key);

  if (!hasS3Config()) {
    const target = path.join(LOCAL_ROOT, ...key.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
    return key;
  }

  const payloadHash = sha256(bytes);
  const signed = s3Authorization("PUT", key, payloadHash, new Date());
  const response = await fetch(signed.url, {
    method: "PUT",
    headers: {
      ...signed.headers,
      "content-type": "application/pdf",
      "content-length": String(bytes.byteLength),
    },
    body: bytes,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Object storage upload failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return key;
}

export async function getPdf(key: string) {
  assertSafeKey(key);
  if (!hasS3Config()) {
    const target = path.join(LOCAL_ROOT, ...key.split("/"));
    return fs.readFile(target);
  }

  const signed = s3Authorization("GET", key, sha256(""), new Date());
  const response = await fetch(signed.url, { headers: signed.headers });
  if (!response.ok) throw new Error(`Could not read stored PDF (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

export async function deletePdf(key: string) {
  assertSafeKey(key);
  if (!hasS3Config()) {
    const target = path.join(LOCAL_ROOT, ...key.split("/"));
    await fs.rm(target, { force: true });
    return;
  }

  const signed = s3Authorization("DELETE", key, sha256(""), new Date());
  const response = await fetch(signed.url, { method: "DELETE", headers: signed.headers });
  if (!response.ok && response.status !== 404) {
    const body = await response.text();
    throw new Error(`Object storage delete failed (${response.status}): ${body.slice(0, 300)}`);
  }
}

export function storageMode() {
  return hasS3Config() ? "s3" : "local";
}
