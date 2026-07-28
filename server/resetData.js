import prisma from "./src/config/prisma.js";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function clearSchemesDatabase() {
  const answer = await new Promise((resolve) => {
    rl.question(
      "⚠️  This will permanently DELETE ALL schemes, bookmarks, and embeddings. Type 'DELETE' to continue: ",
      resolve
    );
  });

  if (answer !== "DELETE") {
    console.log("❌ Operation cancelled.");
    rl.close();
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Delete bookmarks first (FK dependency)
      const bookmarks = await tx.bookmark.deleteMany({});
      console.log(`🗑️ Deleted ${bookmarks.count} bookmarks`);

      // Delete all schemes (embeddings stored in Scheme are deleted automatically)
      const schemes = await tx.scheme.deleteMany({});
      console.log(`🗑️ Deleted ${schemes.count} schemes (including embeddings)`);
    });

    console.log("✅ Database cleaned successfully.");
  } catch (error) {
    console.error("❌ Error while deleting data:", error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

clearSchemesDatabase();