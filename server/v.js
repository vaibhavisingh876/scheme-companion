import prisma from "./src/config/prisma.js";

const schemes = await prisma.scheme.findMany({
  take: 5,
  select: {
    id: true,
    embedding: true,
  },
});

for (const s of schemes) {
  console.log(
    s.id,
    typeof s.embedding,
    Array.isArray(s.embedding),
    s.embedding?.length
  );
}

process.exit(0);