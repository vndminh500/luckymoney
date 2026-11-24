-- CreateEnum
CREATE TYPE "DebtDirection" AS ENUM ('I_OWE', 'THEY_OWE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyDebtEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "DebtDirection" NOT NULL,
    "counterparty" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtInstallment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "upcomingRemindedAt" TIMESTAMP(3),
    "overdueRemindedAt" TIMESTAMP(3),

    CONSTRAINT "DebtInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidOn" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Debt_userId_idx" ON "Debt"("userId");

-- CreateIndex
CREATE INDEX "DebtInstallment_debtId_dueDate_idx" ON "DebtInstallment"("debtId", "dueDate");

-- CreateIndex
CREATE INDEX "DebtPayment_debtId_idx" ON "DebtPayment"("debtId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtInstallment" ADD CONSTRAINT "DebtInstallment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

