-- CreateEnum
CREATE TYPE "CommandType" AS ENUM ('RING');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'EXECUTED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "commands" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "type" "CommandType" NOT NULL,
    "payload" JSONB,
    "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commands_deviceId_idx" ON "commands"("deviceId");

-- CreateIndex
CREATE INDEX "commands_issuedById_idx" ON "commands"("issuedById");

-- CreateIndex
CREATE INDEX "commands_status_expiresAt_idx" ON "commands"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commands" ADD CONSTRAINT "commands_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
