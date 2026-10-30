-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "lastOnlineState" BOOLEAN DEFAULT false,
ADD COLUMN     "networkType" TEXT;
