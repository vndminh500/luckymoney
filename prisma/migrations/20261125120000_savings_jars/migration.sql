-- CreateEnum
CREATE TYPE "SavingsEntryKind" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- CreateTable
CREATE TABLE "SavingsJar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsJar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsEntry" (
    "id" TEXT NOT NULL,
    "jarId" TEXT NOT NULL,
    "kind" "SavingsEntryKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurredOn" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavingsJar_userId_idx" ON "SavingsJar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsJar_userId_name_key" ON "SavingsJar"("userId", "name");

-- CreateIndex
CREATE INDEX "SavingsEntry_jarId_occurredOn_idx" ON "SavingsEntry"("jarId", "occurredOn");

-- AddForeignKey
ALTER TABLE "SavingsJar" ADD CONSTRAINT "SavingsJar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsEntry" ADD CONSTRAINT "SavingsEntry_jarId_fkey" FOREIGN KEY ("jarId") REFERENCES "SavingsJar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

