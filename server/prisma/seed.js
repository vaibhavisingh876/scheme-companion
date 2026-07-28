import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // FIX: upsert by `id` (same key myschemeSync.js uses) instead of `name`.
  // Previously this and syncMyScheme() could disagree on which field
  // identifies "the" myscheme source record, risking two divergent rows
  // (id="myscheme" from sync, name="myscheme" from seed) if ever run out of order.
  await prisma.schemeSource.upsert({
    where: { id: "myscheme" },
    update: {},
    create: {
      id: "myscheme",
      name: "MyScheme Portal",
      sourceUrl: "https://api.myscheme.gov.in",
    },
  });

  console.log("Sources seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());