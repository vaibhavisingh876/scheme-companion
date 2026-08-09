import prisma from "../../config/prisma.js";
import { fetchAllMySchemes } from "../connectors/mySchemeBulkfetcher.js";
import { normalizeMyScheme } from "../normalizers/mySchemeNormalizer.js";
import { fetchSchemeDetail } from "../connectors/mySchemeDetailFetcher.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectWithRetry = async (retries = 5, delayMs = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.log("✅ Database connected successfully.");
      return;
    } catch (err) {
      console.warn(`⚠️ DB connection attempt ${i+1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) {
        const wait = delayMs * Math.pow(2, i);
        console.log(`⏳ Waiting ${wait}ms before retry...`);
        await delay(wait);
      } else {
        throw err;
      }
    }
  }
};

export const syncMyScheme = async () => {
  console.log("⏰ Sync Started...");

  try {
    await connectWithRetry();
  } catch (err) {
    console.error("❌ Failed to connect to database after multiple retries.", err.message);
    return { success: false, error: err.message };
  }

  await prisma.schemeSource.upsert({
    where: { id: "myscheme" },
    update: { lastSyncAt: new Date() },
    create: { id: "myscheme", name: "MyScheme Portal", sourceUrl: "https://www.myscheme.gov.in", lastSyncAt: new Date() },
  });

  let searchHits = [];
  try {
    searchHits = await fetchAllMySchemes();
  } catch (e) {
    console.error("Fetch failed:", e.message);
    await prisma.$disconnect();
    return { success: false };
  }

  if (searchHits.length < 1000) {
    console.error(`🚨 Low count: ${searchHits.length}`);
    await prisma.$disconnect();
    return { success: false };
  }

  const slugMap = new Map();
  for (const hit of searchHits) {
    const fields = hit.fields || hit;
    const slug = fields.slug || fields.schemeSlug;
    if (!slug || slugMap.has(slug)) continue;
    slugMap.set(slug, fields);
  }

  const slugs = Array.from(slugMap.keys());
  console.log(`🔍 ${slugs.length} slugs to enrich`);

  // ✅ Fast – pehle wale jaisa concurrency
  const BATCH_SIZE = 8;
  const BATCH_DELAY = 2000;
  const enrichedSchemes = [];

  for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
    const batch = slugs.slice(i, i + BATCH_SIZE);

    // ✅ Har batch ke liye progress log (taaki pata chale ruk kahan raha hai)
    console.log(`📦 Processing batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(slugs.length/BATCH_SIZE)} (${i+1}-${Math.min(i+BATCH_SIZE, slugs.length)}/${slugs.length})`);

    const results = await Promise.allSettled(
      batch.map(async (slug) => {
        const detail = await fetchSchemeDetail(slug);
        if (!detail) return null;
        return normalizeMyScheme(detail, slugMap.get(slug));
      })
    );

    results.forEach(r => {
      if (r.status === "fulfilled" && r.value) enrichedSchemes.push(r.value);
    });

    // ✅ DB ping – connection alive rakho
    if (i % 200 === 0 && i > 0) {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (pingErr) {
        console.warn("⚠️ Ping failed, reconnecting...");
        await prisma.$disconnect();
        await connectWithRetry(3, 1000);
      }
    }

    if (i + BATCH_SIZE < slugs.length) await delay(BATCH_DELAY);
  }

  console.log(`📊 Enriched: ${enrichedSchemes.length}`);

  const existingSchemes = await prisma.scheme.findMany({
    where: { sourceId: "myscheme" },
    select: { id: true, externalId: true, checksum: true, isActive: true },
  });

  const existingMap = new Map(existingSchemes.map(s => [s.externalId, s]));

  const createBatch = [];
  const updateBatch = [];

  for (const scheme of enrichedSchemes) {
    const existing = existingMap.get(scheme.externalId);
    if (!existing) {
      createBatch.push({ ...scheme, version: 1, lastSyncedAt: new Date(), isActive: true });
    } else if (existing.checksum !== scheme.checksum || !existing.isActive) {
      updateBatch.push({
        id: existing.id,
        data: { ...scheme, version: existing.version + 1, lastSyncedAt: new Date(), isActive: true },
      });
    }
  }

  if (createBatch.length) {
    for (let i = 0; i < createBatch.length; i += 500) {
      await prisma.scheme.createMany({ data: createBatch.slice(i, i + 500), skipDuplicates: true });
    }
  }

  if (updateBatch.length) {
    for (let i = 0; i < updateBatch.length; i += 50) {
      const chunk = updateBatch.slice(i, i + 50);
      await Promise.allSettled(chunk.map(u => prisma.scheme.update({ where: { id: u.id }, data: u.data })));
    }
  }

  console.log(`🏁 Created: ${createBatch.length} | Updated: ${updateBatch.length}`);
  await prisma.$disconnect();
  return { added: createBatch.length, updated: updateBatch.length };
};