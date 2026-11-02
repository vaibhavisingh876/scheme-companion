import prisma from "../../config/prisma.js";
import { fetchAllMySchemes } from "../connectors/mySchemeBulkfetcher.js";
import { normalizeMyScheme } from "../normalizers/mySchemeNormalizer.js";
import { fetchSchemeDetail, fetchSchemeDocuments } from "../connectors/mySchemeDetailFetcher.js";
import {
  buildDescriptionEmbeddingText,
  buildEligibilityEmbeddingText,
} from "../../services/ai/embeddingService.js";
import { delay } from "../../utils/helpers.js";

// schemeCategory entries arrive as { label, value } objects; the DB column is String.
const toLabel = (v) => (v && typeof v === "object" ? v.label || v.name || "" : v);

// Mirrors test.js: search fields are derived from the detail payload itself.
const buildSearchFields = (detail, slug) => ({
  schemeName: detail?.basicDetails?.schemeName || "",
  slug: detail?.slug || slug,
  briefDescription: detail?.basicDetails?.briefDescription || "",
  tags: detail?.tags || [],
  beneficiaryState: detail?.basicDetails?.state?.label ? [detail.basicDetails.state.label] : [],
  schemeCategory: detail?.basicDetails?.schemeCategory || [],
  nodalMinistryName: detail?.basicDetails?.nodalMinistryName || "",
  schemeFor: detail?.basicDetails?.schemeFor || "",
});

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
  const startedAt = new Date();
  let syncJob = null;

  try {
    await connectWithRetry();
  } catch (err) {
    console.error("❌ Failed to connect to database after multiple retries.", err.message);
    return { success: false, error: err.message };
  }

  try {
  syncJob = await prisma.syncJob.create({
    data: { source: "myscheme", status: "running", startedAt },
  });

  let searchHits = [];
  try {
    searchHits = await fetchAllMySchemes();
  } catch (e) {
    console.error("Fetch failed:", e.message);
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { status: "failed", finishedAt: new Date(), error: { message: e.message } },
    });
    await prisma.$disconnect();
    return { success: false, error: e.message };
  }

  if (searchHits.length < 1000) {
    console.error(`🚨 Low count: ${searchHits.length}`);
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        recordsRead: searchHits.length,
        error: { message: `Safety check failed: only ${searchHits.length} source records fetched` },
      },
    });
    await prisma.$disconnect();
    return { success: false, error: "Source record count below safety threshold" };
  }

  const slugMap = new Map();
  for (const item of searchHits) {
    const slug = item?.slug;
    if (!slug || slugMap.has(slug)) continue;
    slugMap.set(slug, item);
  }

  const slugs = Array.from(slugMap.keys());
  console.log(`🔍 ${slugs.length} slugs to enrich`);
  if (slugs.length < 1000) {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        recordsRead: searchHits.length,
        error: { message: `Safety check failed: only ${slugs.length} unique scheme slugs fetched` },
      },
    });
    await prisma.$disconnect();
    return { success: false, error: "Unique source scheme count below safety threshold" };
  }

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

        const documents = await fetchSchemeDocuments(slugMap.get(slug)?._id);
        if (documents?.length) {
          detail.schemeContent = {
            ...(detail.schemeContent || {}),
            documentsRequired: documents,
          };
        }

        return normalizeMyScheme(detail, buildSearchFields(detail, slug));
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
  if (enrichedSchemes.length !== slugs.length) {
    const message = `Incomplete enrichment (${enrichedSchemes.length}/${slugs.length}); skipped database updates and deactivation`;
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        recordsRead: searchHits.length,
        error: { message },
      },
    });
    await prisma.$disconnect();
    return { success: false, error: message };
  }

  const existingSchemes = await prisma.scheme.findMany({
    where: { sourceId: "myscheme" },
    select: {
      id: true,
      externalId: true,
      checksum: true,
      version: true,
      isActive: true,
      name: true,
      description: true,
      benefits: true,
      eligibility: true,
      category: true,
      ministry: true,
      tags: true,
      schemeFor: true,
    },
  });

  const existingMap = new Map(existingSchemes.map(s => [s.externalId, s]));

  const createBatch = [];
  const updateBatch = [];

  for (const scheme of enrichedSchemes) {
    const { _semanticDebug, ...dbScheme } = scheme;
    dbScheme.category = toLabel(dbScheme.category);
    const existing = existingMap.get(dbScheme.externalId);
    if (!existing) {
      createBatch.push({ ...dbScheme, version: 1, lastSyncedAt: new Date(), isActive: true });
    } else if (existing.checksum !== dbScheme.checksum || !existing.isActive) {
      const staleEmbeddings = {};
      if (buildDescriptionEmbeddingText(existing) !== buildDescriptionEmbeddingText(dbScheme)) {
        staleEmbeddings.descriptionEmbedding = [];
      }
      if (buildEligibilityEmbeddingText(existing) !== buildEligibilityEmbeddingText(dbScheme)) {
        staleEmbeddings.eligibilityEmbedding = [];
      }
      updateBatch.push({
        id: existing.id,
        data: {
          ...dbScheme,
          ...staleEmbeddings,
          version: existing.version + 1,
          lastSyncedAt: new Date(),
          isActive: true,
        },
      });
    }
  }

  if (createBatch.length) {
    for (let i = 0; i < createBatch.length; i += 500) {
      await prisma.scheme.createMany({ data: createBatch.slice(i, i + 500), skipDuplicates: true });
    }
  }

  if (updateBatch.length) {
    // Keep concurrent writes well below the Supabase session pool limit.
    const UPDATE_CONCURRENCY = 3;
    for (let i = 0; i < updateBatch.length; i += UPDATE_CONCURRENCY) {
      const chunk = updateBatch.slice(i, i + UPDATE_CONCURRENCY);
      await Promise.all(chunk.map(u => prisma.scheme.update({ where: { id: u.id }, data: u.data })));
    }
  }

  // Stamp every seen scheme, including unchanged records. This gives the
  // deactivation query a complete-sync marker without a huge NOT IN list.
  await prisma.scheme.updateMany({
    where: { sourceId: "myscheme", externalId: { in: slugs } },
    data: { lastSyncedAt: startedAt, isActive: true },
  });
  const deactivated = await prisma.scheme.updateMany({
    where: {
      sourceId: "myscheme",
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: startedAt } }],
    },
    data: { isActive: false },
  });

  await prisma.schemeSource.upsert({
    where: { id: "myscheme" },
    update: { lastSyncAt: new Date() },
    create: { id: "myscheme", name: "MyScheme Portal", sourceUrl: "https://www.myscheme.gov.in", lastSyncAt: new Date() },
  });

  await prisma.syncJob.update({
    where: { id: syncJob.id },
    data: {
      status: "success",
      finishedAt: new Date(),
      recordsRead: searchHits.length,
      recordsAdded: createBatch.length,
      recordsUpdated: updateBatch.length,
    },
  });

  console.log(`🏁 Created: ${createBatch.length} | Updated: ${updateBatch.length} | Deactivated: ${deactivated.count}`);
  await prisma.$disconnect();
  return { success: true, added: createBatch.length, updated: updateBatch.length, deactivated: deactivated.count };
  } catch (err) {
    console.error("❌ Sync failed:", err.message);
    if (syncJob) {
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: { status: "failed", finishedAt: new Date(), error: { message: err.message } },
      }).catch((jobError) => console.error("Could not update SyncJob:", jobError.message));
    }
    await prisma.$disconnect();
    return { success: false, error: err.message };
  }
};
