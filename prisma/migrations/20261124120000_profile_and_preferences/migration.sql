-- CreateEnum
CREATE TYPE "AmountFormat" AS ENUM ('SYMBOL', 'DONG', 'SHORT');

-- CreateEnum
CREATE TYPE "DateFormat" AS ENUM ('DMY', 'ISO');

-- CreateEnum
CREATE TYPE "WeekStart" AS ENUM ('MONDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "amountFormat" "AmountFormat" NOT NULL DEFAULT 'SYMBOL',
ADD COLUMN     "birthDate" TEXT,
ADD COLUMN     "dateFormat" "DateFormat" NOT NULL DEFAULT 'DMY',
ADD COLUMN     "notifyBudgetOver" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyBudgetWarning" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "username" TEXT,
ADD COLUMN     "weekStart" "WeekStart" NOT NULL DEFAULT 'MONDAY';

-- CreateTable
CREATE TABLE "UserAvatar" (
    "userId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAvatar_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "UserAvatar" ADD CONSTRAINT "UserAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

