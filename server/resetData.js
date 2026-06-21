import prisma from "./src/config/prisma.js";

async function resetData() {
  try {
    console.log("🗑️ Removing bookmarks...");
    await prisma.bookmark.deleteMany();

    console.log("🗑️ Removing schemes...");
    await prisma.scheme.deleteMany();

    console.log("🗑️ Removing raw schemes...");
    await prisma.rawScheme.deleteMany();

    console.log("🗑️ Removing sync jobs...");
    await prisma.syncJob.deleteMany();

    console.log("✅ Database cleaned successfully.");
  } catch (error) {
    console.error("❌ Reset failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

resetData();