import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

// Shell/CI may set DATABASE_URL to localhost; prefer project .env for Neon.
dotenv.config({ override: true });

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: npx tsx scratch/verify-login.ts <email> <password>");
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log("status=USER_NOT_FOUND");
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  console.log(`status=USER_FOUND`);
  console.log(`password_match=${passwordMatch}`);
  console.log(`role=${user.role}`);
  console.log(`has_society=${Boolean(user.societyId)}`);
}

main()
  .catch((error) => {
    console.error("status=DB_ERROR");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.cause) console.error("cause:", error.cause);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
