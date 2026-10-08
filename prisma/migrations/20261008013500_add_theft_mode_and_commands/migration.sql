-- AlterEnum
ALTER TYPE "CommandType" ADD VALUE 'THEFT_MODE_ON';
ALTER TYPE "CommandType" ADD VALUE 'THEFT_MODE_OFF';

-- AlterTable
ALTER TABLE "devices" ADD COLUMN "theftModeActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "theft_modes" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "activatedById" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "message" TEXT NOT NULL,
    "contactPhone" TEXT,
    "locationIntervalSeconds" INTEGER NOT NULL,
    "alarm" BOOLEAN NOT NULL,
    "lock" BOOLEAN NOT NULL,

    CONSTRAINT "theft_modes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "theft_modes_deviceId_idx" ON "theft_modes"("deviceId");

-- CreateIndex
CREATE INDEX "theft_modes_activatedById_idx" ON "theft_modes"("activatedById");

-- CreateIndex
CREATE INDEX "theft_modes_deviceId_deactivatedAt_idx" ON "theft_modes"("deviceId", "deactivatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "theft_modes_one_active_per_device_idx" ON "theft_modes"("deviceId") WHERE "deactivatedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "theft_modes" ADD CONSTRAINT "theft_modes_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theft_modes" ADD CONSTRAINT "theft_modes_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
