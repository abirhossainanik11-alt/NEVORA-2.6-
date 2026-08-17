import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SUBJECT_SEED } from "../src/lib/subjects";

const prisma = new PrismaClient();

async function main() {
  for (const s of SUBJECT_SEED) {
    await prisma.subject.upsert({
      where: { key: s.key },
      update: { name: s.name, shortDesc: s.shortDesc, icon: s.icon, order: s.order, active: true, maxResources: 5 },
      create: { key: s.key, name: s.name, shortDesc: s.shortDesc, icon: s.icon, order: s.order, maxResources: 5 },
    });
  }

  await prisma.subject.updateMany({ where: { key: { notIn: SUBJECT_SEED.map((s) => s.key) } }, data: { active: false } });

  await prisma.aIConfiguration.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  // Initial default Admin password, per spec §31 — MUST be changed after
  // first login. Never treat this as a permanent production credential.
  const DEFAULT_ADMIN_PASSWORD = "261209";
  const adminPasswordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

  await prisma.systemConfiguration.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      aiName: "NEVORA",
      aiCreator: "Abir Hossain",
      aiPublicIdentity: "I am NEVORA, an AI educational assistant designed for SSC-level learning. I was created by Abir Hossain.",
    },
  });

  // Seed one ADMIN user account so there's a way to log in on first run.
  // Change ADMIN_EMAIL below (or via env) before deploying.
  const adminEmail = process.env.NEVORA_ADMIN_EMAIL ?? "admin@example.com";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      displayName: "Abir Hossain",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  console.log(`Seed complete. Admin login: ${adminEmail} / 261209 — change this password immediately after first login.`);
}

main().finally(() => prisma.$disconnect());
