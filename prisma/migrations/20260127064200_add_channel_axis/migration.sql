-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('naver', 'linkedin', 'threads');

-- DropIndex
DROP INDEX "compliance_reports_content_id_key";

-- DropIndex
DROP INDEX "content_versions_content_id_version_type_idx";

-- AlterTable
ALTER TABLE "compliance_reports" ADD COLUMN     "channel" "Channel" NOT NULL DEFAULT 'naver';

-- AlterTable
ALTER TABLE "content_versions" ADD COLUMN     "channel" "Channel" NOT NULL DEFAULT 'naver';

-- CreateIndex
CREATE INDEX "compliance_reports_content_id_channel_idx" ON "compliance_reports"("content_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_reports_content_id_channel_key" ON "compliance_reports"("content_id", "channel");

-- CreateIndex
CREATE INDEX "content_versions_content_id_channel_idx" ON "content_versions"("content_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_content_id_channel_version_type_key" ON "content_versions"("content_id", "channel", "version_type");

