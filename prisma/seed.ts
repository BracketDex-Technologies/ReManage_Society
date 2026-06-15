import "dotenv/config";

async function main() {
  console.log("No seed data is created for this SaaS product.");
  console.log("Create real societies via /register and real residents via /join.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {});
