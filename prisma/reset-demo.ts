import { PrismaClient } from "@prisma/client";

if (process.env.CONFIRM_DEMO_RESET !== "YES") {
  throw new Error("Refusing demo reset. Set CONFIRM_DEMO_RESET=YES to remove and recreate demo-owned data.");
}

const prisma = new PrismaClient();

try {
  await prisma.user.deleteMany({ where: { email: "demo@statecraft.online" } });
  console.log("Demo-owned data removed. Run npm run prisma:seed to recreate it.");
} finally {
  await prisma.$disconnect();
}
