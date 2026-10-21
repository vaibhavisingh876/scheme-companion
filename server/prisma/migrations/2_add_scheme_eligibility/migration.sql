-- CreateTable
CREATE TABLE "SchemeEligibility" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "extractedRules" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "modelVersion" TEXT NOT NULL DEFAULT 'unknown',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchemeEligibility_schemeId_key" ON "SchemeEligibility"("schemeId");

-- CreateIndex
CREATE INDEX "SchemeEligibility_status_idx" ON "SchemeEligibility"("status");

-- CreateIndex
CREATE INDEX "SchemeEligibility_sourceHash_idx" ON "SchemeEligibility"("sourceHash");
