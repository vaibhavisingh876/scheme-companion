import prisma from "../../config/prisma.js";
import { fetchAllMySchemes } from "../connectors/mySchemeBulkfetcher.js";
import { normalizeMyScheme } from "../normalizers/mySchemeNormalizer.js";
import { fetchSchemeDetail } from "../../services/ai/groqService.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to retry a detail fetch on 429 / server errors
const fetchWithRetry = async (slug, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchSchemeDetail(slug);
    } catch (err) {
      if (
        attempt < retries &&
        (err.response?.status === 429 || err.response?.status >= 500)
      ) {
        console.warn(
          `⏳ Rate limit / server error on ${slug} – retrying in ${attempt * 2}s (attempt ${attempt + 1}/${retries})`
        );
        await delay(attempt * 2000);
      } else {
        throw err;
      }
    }
  }
};

export const syncMyScheme = async () => {
  console.log("⏰ Sending wake-up ping to Neon Database...");
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("🟢 Neon Database is awake and connection pool is ready!");
  } catch (e) {
    console.log("⚠️ Database is taking a moment to wake up, moving forward...");
  }

  // Ensure parent source exists
  try {
    await prisma.schemeSource.upsert({
      where: { id: "myscheme" },
      update: { lastSyncAt: new Date() },
      create: {
        id: "myscheme",
        name: "MyScheme Portal",
        sourceUrl: "https://www.myscheme.gov.in",
        lastSyncAt: new Date(),
      },
    });
    console.log("✅ Ensured 'myscheme' Parent Source identity exists.");
  } catch (sourceError) {
    console.error("🛑 Failed to verify parent source record.", sourceError);
    return { success: false, error: "Parent Source Verification Failed" };
  }

  // 1. Fetch all search hits (basic fields + slug)
  let searchHits = [];
  try {
    searchHits = await fetchAllMySchemes();
  } catch (fetchError) {
    console.error("🛑 Sync Aborted: Data extraction failed.", fetchError.message);
    return { success: false, error: fetchError.message };
  }

  // Build slug → searchFields map, deduplicate
  const slugMap = new Map();
  for (const hit of searchHits) {
    const fields = hit.fields || hit;
    const slug = fields.slug || fields.schemeSlug;
    if (!slug) continue;
    if (slugMap.has(slug)) {
      console.warn(`⚡ Duplicate slug ${slug} in search results, skipping.`);
      continue;
    }
    slugMap.set(slug, fields);
  }

  const slugs = Array.from(slugMap.keys());
  console.log(`🔍 Total unique slugs to enrich: ${slugs.length}`);

  // 2. Fetch detail for each slug in parallel batches (gentle rate limiting)
  const BATCH_SIZE = 2;         // low concurrency
  const BATCH_DELAY = 2000;     // 2 seconds between batches
  const enrichedSchemes = [];

  for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
    const batch = slugs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (slug) => {
        const detail = await fetchWithRetry(slug);
        if (!detail) return null;
        const searchFields = slugMap.get(slug);
        const normalized = normalizeMyScheme(detail, searchFields);
        return normalized;
      })
    );

    batchResults.forEach((res) => {
      if (res.status === "fulfilled" && res.value) {
        enrichedSchemes.push(res.value);
      }
    });

    console.log(
      `📥 Enriched ${Math.min(i + BATCH_SIZE, slugs.length)} / ${slugs.length}`
    );

    if (i + BATCH_SIZE < slugs.length) {
      await delay(BATCH_DELAY);
    }
  }

  console.log(`📊 Total schemes ready for sync: ${enrichedSchemes.length}`);

  // 3. Load existing DB records
  console.log("🔍 Loading existing DB schemes...");
  let existingSchemes = [];
  const READ_CHUNK_SIZE = 100;
  let lastId = undefined;

  while (true) {
    let chunk = [];
    try {
      chunk = await prisma.scheme.findMany({
        where: { sourceId: "myscheme" },
        select: { id: true, externalId: true, checksum: true, version: true, isActive: true },
        take: READ_CHUNK_SIZE,
        skip: lastId ? 1 : 0,
        cursor: lastId ? { id: lastId } : undefined,
        orderBy: { id: "asc" },
      });
    } catch (error) {
      console.warn("DB read chunk error, retrying...", error);
      await delay(2000);
      continue;
    }
    if (chunk.length === 0) break;
    existingSchemes.push(...chunk);
    lastId = chunk[chunk.length - 1].id;
  }

  const dbMap = new Map(existingSchemes.map((s) => [s.externalId, s]));

  // 4. Classify: create / update / skip
  const createBatch = [];
  const updateBatch = [];
  let skipped = 0;

  for (const scheme of enrichedSchemes) {
    const existing = dbMap.get(scheme.externalId);
    if (!existing) {
      createBatch.push({
        ...scheme,
        version: 1,
        lastSyncedAt: new Date(),
        isActive: true,
      });
    } else {
      const dataChanged = existing.checksum !== scheme.checksum;
      const wasInactive = !existing.isActive;
      if (!dataChanged && !wasInactive) {
        skipped++;
        continue;
      }
      updateBatch.push({
        id: existing.id,
        data: {
          ...scheme,
          version: dataChanged ? existing.version + 1 : existing.version,
          lastSyncedAt: new Date(),
          isActive: true,
        },
      });
    }
  }

  // 5. DB writes
  if (createBatch.length) {
    console.log(`📥 Bulk inserting ${createBatch.length} new schemes...`);
    const CHUNK = 500;
    for (let i = 0; i < createBatch.length; i += CHUNK) {
      const chunk = createBatch.slice(i, i + CHUNK);
      await prisma.scheme.createMany({ data: chunk, skipDuplicates: true });
      console.log(`✅ Created sub-batch ${i + chunk.length}`);
      await delay(1000);
    }
  }

  if (updateBatch.length) {
    console.log(`⚙️ Updating ${updateBatch.length} schemes...`);
    for (let i = 0; i < updateBatch.length; i++) {
      const u = updateBatch[i];
      try {
        await prisma.scheme.update({ where: { id: u.id }, data: u.data });
      } catch (err) {
        console.error(`❌ Failed to update ${u.id}:`, err.message);
      }
      if (i % 50 === 0) await delay(2000);
    }
  }

  // Soft deletes
  const incomingIds = new Set(enrichedSchemes.map((s) => s.externalId));
  const toDeactivate = existingSchemes.filter(
    (s) => s.isActive && !incomingIds.has(s.externalId)
  );
  let deactivatedCount = 0;
  if (toDeactivate.length > 0) {
    const thresholdExceeded = toDeactivate.length > existingSchemes.length * 0.4;
    if (thresholdExceeded) {
      console.error("🚨 ANOMALOUS deletion rate detected. Skipping soft-delete.");
    } else {
      const res = await prisma.scheme.updateMany({
        where: { id: { in: toDeactivate.map((s) => s.id) } },
        data: { isActive: false, lastSyncedAt: new Date() },
      });
      deactivatedCount = res.count;
      console.log(`♻️ Soft-deactivated ${deactivatedCount} stale schemes.`);
    }
  }

  console.log(
    `🏁 Pipeline Report -> Added: ${createBatch.length} | Updated: ${updateBatch.length} | Unchanged: ${skipped} | Deactivated: ${deactivatedCount}`
  );

  return {
    added: createBatch.length,
    updated: updateBatch.length,
    skipped,
    deactivated: deactivatedCount,
  };
};