import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.schemeSource.upsert({
    where: { name: "myscheme" },
    update: {},
    create: {
      id: "myscheme",
      name: "myscheme",
      sourceUrl: "https://api.myscheme.gov.in"
    }
  });

  await prisma.schemeSource.upsert({
    where: { name: "datagov" },
    update: {},
    create: {
      id: "datagov",
      name: "datagov",
      sourceUrl: "https://data.gov.in"
    }
  });

  console.log("Sources seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());