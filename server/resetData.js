import prisma from "./src/config/prisma.js";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function deleteSchemesAndEmbeddings() {
  // Safety check: confirm before deleting everything
  const answer = await new Promise((resolve) => {
    rl.question(
      "⚠️  This will DELETE ALL SCHEMES and their BOOKMARKS. Type 'yes' to confirm: ",
      resolve
    );
  });

  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Aborted.");
    rl.close();
    return;
  }

  try {
    // 1. Delete all bookmarks (to avoid foreign key constraint violations)
    const deletedBookmarks = await prisma.bookmark.deleteMany({});
    console.log(`🗑️  Deleted ${deletedBookmarks.count} bookmarks`);

    // 2. Delete all schemes (embedding is part of the scheme row, deleted automatically)
    const deletedSchemes = await prisma.scheme.deleteMany({});
    console.log(`🗑️  Deleted ${deletedSchemes.count} schemes (embeddings gone with them)`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

deleteSchemesAndEmbeddings();