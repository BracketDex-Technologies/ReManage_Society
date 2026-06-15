import { prisma } from "../src/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      societyId: true,
      flatId: true,
    }
  });
  console.log("Users in DB:", JSON.stringify(users, null, 2));
}

main().catch(console.error);
