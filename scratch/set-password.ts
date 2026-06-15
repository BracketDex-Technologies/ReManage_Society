import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const hashedPassword = await bcrypt.hash("password", 10);
  const updatedUser = await prisma.user.update({
    where: { email: "choudharidarshan5453@gmail.com" },
    data: { password: hashedPassword },
  });
  console.log("Updated user password for:", updatedUser.email);
}

main().catch(console.error);
