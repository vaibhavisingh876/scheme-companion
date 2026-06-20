import prisma from "../../config/prisma.js";
import { fetchAllMySchemes } from "../connectors/mySchemeBulkFetcher.js";
import { normalizeMyScheme } from "../normalizers/mySchemeNormalizer.js";

// 🧊 HELPER: Neon DB ko thanda rakhne ke liye delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const syncMyScheme = async () => {
  console.log("⏰ Sending wake-up ping to Neon Database...");
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("🟢 Neon Database is awake and connection pool is ready!");
  } catch (e) {
    console.log("⚠️ Database is taking a moment to wake up, moving forward...");
  }

  // --------------------------------------------------------------------------------
  // ⚡ FIX: STEP 0 - ENSURE PARENT SOURCE EXISTS BEFORE INSERTING CHILDREN
  // --------------------------------------------------------------------------------
  try {
    await prisma.schemeSource.upsert({
      where: { id: "myscheme" },
      update: { lastSyncAt: new Date() },
      create: {
        id: "myscheme",
        name: "MyScheme Portal",
        sourceUrl: "https://www.myscheme.gov.in",
        lastSyncAt: new Date()
      }
    });
    console.log("✅ Ensured 'myscheme' Parent Source identity exists in the database.");
  } catch (sourceError) {
    console.error("🛑 Failed to verify or create parent source record.", sourceError);
    return { success: false, error: "Parent Source Verification Failed" };
  }
  // --------------------------------------------------------------------------------

  let rawSchemes = [];
  
  try {
    rawSchemes = await fetchAllMySchemes();
  } catch (fetchError) {
    console.error("🛑 Sync Aborted safely: Data extraction stream failure hook encountered.", fetchError.message);
    return { success: false, error: fetchError.message };
  }

  console.log(`🔄 System entering Sync sequence loop mapping for ${rawSchemes.length} records...`);

  const incomingIds = new Set();
  const dedupedIncomingSchemes = new Map();

  // Step 1: Parse and run an intensive deduplication layer over raw datasets
  for (const raw of rawSchemes) {
    const scheme = normalizeMyScheme(raw);
    if (!scheme?.externalId) continue;

    // Local edge validation tracking mechanism
    if (dedupedIncomingSchemes.has(scheme.externalId)) {
      console.warn(`⚡ Internal duplicate filter hit for externalId: ${scheme.externalId}`);
      continue;
    }

    incomingIds.add(scheme.externalId);
    dedupedIncomingSchemes.set(scheme.externalId, scheme);
  }

  // --------------------------------------------------------------------------------
  // ⚡ STEP 2 - BATCHED DB READS WITH AUTO-RETRY (Bypasses Connection Drops)
  // --------------------------------------------------------------------------------
  console.log("🔍 Extracting existing structural matrix states via paginated db chunks...");
  
  let existingSchemes = [];
  const READ_CHUNK_SIZE = 100;
  let lastId = undefined;
  
  while (true) {
    let chunk = [];
    let retries = 3; 

    while (retries > 0) {
      try {
        chunk = await prisma.scheme.findMany({
          where: { sourceId: "myscheme" },
          select: { id: true, externalId: true, checksum: true, version: true, isActive: true },
          take: READ_CHUNK_SIZE,
          skip: lastId ? 1 : 0, 
          cursor: lastId ? { id: lastId } : undefined,
          orderBy: { id: "asc" }
        });
        break; 
      } catch (error) {
        console.log(`⚠️ DB Connection slow, waiting for Neon to wake up... (${retries} attempts left)`);
        retries -= 1;
        if (retries === 0) throw error; 
        
        await delay(3000); 
      }
    }
    
    if (chunk.length === 0) break; 
    
    existingSchemes.push(...chunk);
    lastId = chunk[chunk.length - 1].id; 
  }

  console.log(`✅ Loaded ${existingSchemes.length} existing structural matrix paths into memory.`);
  // --------------------------------------------------------------------------------

  const dbMap = new Map(existingSchemes.map((s) => [s.externalId, s]));

  const createBatch = [];
  const updateBatch = [];
  let skipped = 0;

  // Step 3: Classify items into their respective database processing paths
  for (const [externalId, scheme] of dedupedIncomingSchemes.entries()) {
    const existing = dbMap.get(externalId);

    if (!existing) {
      createBatch.push({
        ...scheme,
        version: 1,
        lastSyncedAt: new Date(),
        isActive: true,
      });
    } else {
      const identityStateChanged = !existing.isActive;
      const dataStateChanged = existing.checksum !== scheme.checksum;

      if (!dataStateChanged && !identityStateChanged) {
        skipped++;
        continue;
      }

      updateBatch.push({
        id: existing.id,
        data: {
          ...scheme,
          version: dataStateChanged ? existing.version + 1 : existing.version,
          lastSyncedAt: new Date(),
          isActive: true, 
        },
      });
    }
  }

  // ⚡ TRANSACTION EXECUTION WINDOWS

  // Path A: Bulk Write Creation via Optimized native batch loops
  if (createBatch.length) {
    console.log(`📥 Bulk importing ${createBatch.length} new records into DB...`);
    const WRITE_CHUNK_SIZE = 500;
    for (let i = 0; i < createBatch.length; i += WRITE_CHUNK_SIZE) {
      const currentBatchChunk = createBatch.slice(i, i + WRITE_CHUNK_SIZE);
      await prisma.scheme.createMany({
        data: currentBatchChunk,
        skipDuplicates: true,
      });
      console.log(`✅ Created sub-batch chunk records mappings ${i + currentBatchChunk.length}`);
      await delay(1000); // 🧊 Har 500 create ke baad thoda pause
    }
  }

  // Path B: Segmented Chunks Loop Updates (Mitigates DB Connection Choking)
  if (updateBatch.length) {
    console.log(`⚙️ Executing SEQUENTIAL processing for ${updateBatch.length} structural mutations...`);
    
    for (let i = 0; i < updateBatch.length; i++) {
      const u = updateBatch[i];
      
      try {
        await prisma.scheme.update({
          where: { id: u.id },
          data: u.data,
        });
      } catch (err) {
        console.error(`❌ Failed to update scheme ${u.id}:`, err.message);
      }

      // 🧊 DB COOL DOWN: Har 50 updates ke baad 2 seconds ka pause
      if (i > 0 && i % 50 === 0) {
        console.log(`⏳ Processed ${i} / ${updateBatch.length} updates. Cooling down DB...`);
        await delay(2000);
      }
    }
  }

  // Path C: Safe Target-Verified Guarded Soft Deletes
  const toDeactivate = existingSchemes.filter(
    (s) => s.isActive && !incomingIds.has(s.externalId)
  );

  let deactivatedCount = 0;
  if (toDeactivate.length > 0) {
    const deletionThresholdTriggered = toDeactivate.length > (existingSchemes.length * 0.40);

    if (deletionThresholdTriggered) {
      console.error(`🚨 EMERGENCY BREAK SYSTEM ENGAGED: An anomalous deletion rate was detected (${toDeactivate.length} items flagged). Skipping soft-delete phase.`);
    } else {
      const deactivationResult = await prisma.scheme.updateMany({
        where: {
          id: { in: toDeactivate.map((s) => s.id) },
        },
        data: {
          isActive: false,
          lastSyncedAt: new Date(),
        },
      });
      deactivatedCount = deactivationResult.count;
      console.log(`♻️ Successfully soft-deactivated ${deactivatedCount} dead context entries.`);
    }
  }

  console.log(`🏁 Pipeline Report -> Added: ${createBatch.length} | Updated: ${updateBatch.length} | Unchanged: ${skipped} | Deactivated: ${deactivatedCount}`);

  return {
    added: createBatch.length,
    updated: updateBatch.length,
    skipped,
    deactivated: deactivatedCount,
  };
};