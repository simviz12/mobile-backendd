-- CreateEnum
CREATE TYPE "DeviceMode" AS ENUM ('PROTECTED', 'CONTROLLER');

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "model" TEXT,
    "osVersion" TEXT,
    "appVersion" TEXT,
    "mode" "DeviceMode" NOT NULL,
    "fcmToken" TEXT,
    "deviceTokenHash" TEXT,
    "batteryLevel" INTEGER,
    "isCharging" BOOLEAN,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "devices_ownerId_idx" ON "devices"("ownerId");

-- CreateIndex
CREATE INDEX "devices_deviceTokenHash_idx" ON "devices"("deviceTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "devices_ownerId_installId_key" ON "devices"("ownerId", "installId");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
