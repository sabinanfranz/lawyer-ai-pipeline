-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('drafted', 'revised');

-- CreateEnum
CREATE TYPE "VersionType" AS ENUM ('draft', 'revised');

-- CreateTable
CREATE TABLE "contents" (
    "id" TEXT NOT NULL,
    "share_id" TEXT NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'drafted',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_versions" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "version_type" "VersionType" NOT NULL,
    "title_candidates" JSONB,
    "body_md" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_reports" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "issues" JSONB,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contents_share_id_key" ON "contents"("share_id");

-- CreateIndex
CREATE INDEX "content_versions_content_id_version_type_idx" ON "content_versions"("content_id", "version_type");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_reports_content_id_key" ON "compliance_reports"("content_id");

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
