-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('queued', 'processing', 'complete', 'failed');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS dummy_placeholder TEXT;
ALTER TABLE "Project" DROP COLUMN IF EXISTS dummy_placeholder;

-- CreateTable
CREATE TABLE "Export" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "output_url" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Export_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Export" ADD CONSTRAINT "Export_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
