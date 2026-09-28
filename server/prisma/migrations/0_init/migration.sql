-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "benefits" TEXT NOT NULL,
    "eligibility" TEXT NOT NULL,
    "category" TEXT,
    "ministry" TEXT,
    "state" TEXT,
    "gender" TEXT,
    "occupation" TEXT,
    "educationLevel" TEXT,
    "allowedCategories" TEXT[],
    "allowedStates" TEXT[],
    "allowedGenders" TEXT[],
    "allowedOccupations" TEXT[],
    "allowedEducationLevels" TEXT[],
    "minIncome" INTEGER,
    "maxIncome" INTEGER,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "applicationLink" TEXT,
    "sourceUrl" TEXT,
    "tags" TEXT[],
    "documentsRequired" TEXT,
    "externalId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "isScholarship" BOOLEAN NOT NULL DEFAULT false,
    "isFemaleOnly" BOOLEAN NOT NULL DEFAULT false,
    "schemeFor" TEXT,
    "descriptionEmbedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "eligibilityEmbedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawScheme" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsAdded" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "error" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scheme_state_idx" ON "Scheme"("state");

-- CreateIndex
CREATE INDEX "Scheme_occupation_idx" ON "Scheme"("occupation");

-- CreateIndex
CREATE INDEX "Scheme_educationLevel_idx" ON "Scheme"("educationLevel");

-- CreateIndex
CREATE INDEX "Scheme_minIncome_idx" ON "Scheme"("minIncome");

-- CreateIndex
CREATE INDEX "Scheme_maxIncome_idx" ON "Scheme"("maxIncome");

-- CreateIndex
CREATE INDEX "Scheme_minAge_idx" ON "Scheme"("minAge");

-- CreateIndex
CREATE INDEX "Scheme_maxAge_idx" ON "Scheme"("maxAge");

-- CreateIndex
CREATE INDEX "Scheme_category_idx" ON "Scheme"("category");

-- CreateIndex
CREATE INDEX "Scheme_ministry_idx" ON "Scheme"("ministry");

-- CreateIndex
CREATE INDEX "Scheme_isActive_idx" ON "Scheme"("isActive");

-- CreateIndex
CREATE INDEX "Scheme_allowedCategories_idx" ON "Scheme"("allowedCategories");

-- CreateIndex
CREATE INDEX "Scheme_allowedStates_idx" ON "Scheme"("allowedStates");

-- CreateIndex
CREATE INDEX "Scheme_allowedGenders_idx" ON "Scheme"("allowedGenders");

-- CreateIndex
CREATE INDEX "Scheme_allowedOccupations_idx" ON "Scheme"("allowedOccupations");

-- CreateIndex
CREATE INDEX "Scheme_allowedEducationLevels_idx" ON "Scheme"("allowedEducationLevels");

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_sourceId_externalId_key" ON "Scheme"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeSource_name_key" ON "SchemeSource"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Bookmark_userId_schemeId_key" ON "Bookmark"("userId", "schemeId");

-- AddForeignKey
ALTER TABLE "Scheme" ADD CONSTRAINT "Scheme_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SchemeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Scheme" ADD COLUMN "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[], ADD COLUMN "searchText" TEXT;
