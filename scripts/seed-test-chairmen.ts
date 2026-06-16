/**
 * Demo/staging chairman accounts for UAT — keep for test logins.
 * Run: npm run db:seed:test-chairmen
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../packages/db/src/prisma.ts";
import { generateJoinCode } from "../src/lib/join-code.ts";

const TEST_PASSWORD = "123123";

const TEST_CHAIRMEN = [
  {
    email: "test-chairman-1@remanage.local",
    name: "Test Chairman One",
    societyName: "Test Society Alpha",
    societyAddress: "100 Test Lane, Block A",
    city: "Mumbai",
    pincode: "400001",
  },
  {
    email: "test-chairman-2@remanage.local",
    name: "Test Chairman Two",
    societyName: "Test Society Beta",
    societyAddress: "200 Test Lane, Block B",
    city: "Mumbai",
    pincode: "400002",
  },
] as const;

async function ensureJoinCode(societyName: string): Promise<string> {
  let joinCode = generateJoinCode(societyName);
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.society.findUnique({ where: { joinCode } });
    if (!existing) return joinCode;
    joinCode = generateJoinCode(societyName);
  }
  throw new Error(`Could not generate unique join code for ${societyName}`);
}

async function main() {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);

  for (const account of TEST_CHAIRMEN) {
    const email = account.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          role: "chairman",
          name: account.name,
        },
      });
      console.log(`Updated existing test chairman: ${email}`);
      continue;
    }

    const joinCode = await ensureJoinCode(account.societyName);

    const { user, society } = await prisma.$transaction(async (tx) => {
      const society = await tx.society.create({
        data: {
          name: account.societyName,
          joinCode,
          address: account.societyAddress,
          city: account.city,
          pincode: account.pincode,
          subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          planTier: "trial",
        },
      });

      const user = await tx.user.create({
        data: {
          name: account.name,
          email,
          password: hashedPassword,
          role: "chairman",
          societyId: society.id,
        },
      });

      return { user, society };
    });

    console.log(`Created test chairman: ${user.email} (society: ${society.name}, join code: ${society.joinCode})`);
  }

  console.log("\nDemo chairman logins:");
  for (const account of TEST_CHAIRMEN) {
    console.log(`  Email: ${account.email}  Password: ${TEST_PASSWORD}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
