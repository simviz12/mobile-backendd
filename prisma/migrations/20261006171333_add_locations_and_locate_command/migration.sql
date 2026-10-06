-- CreateEnum
CREATE TYPE "LocationSource" AS ENUM ('LOCATE_COMMAND', 'PERIODIC', 'THEFT_MODE');

-- AlterEnum
ALTER TYPE "CommandType" ADD VALUE 'LOCATE';

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyMeters" DOUBLE PRECISION,
    "speedMps" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "LocationSource" NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_deviceId_recordedAt_idx" ON "locations"("deviceId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "locations_recordedAt_idx" ON "locations"("recordedAt");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
