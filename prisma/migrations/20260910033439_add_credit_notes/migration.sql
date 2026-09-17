-- AlterTable
-- "remainingAmount" is added nullable first, backfilled from "amount" for
-- any existing rows, then locked to NOT NULL below — store_credits was
-- only just created (20260908123238) and never written to by any app
-- code until now, so this is expected to touch zero rows, but the
-- backfill keeps the migration safe either way.
ALTER TABLE "store_credits" ADD COLUMN     "remainingAmount" DECIMAL(12,2);
ALTER TABLE "store_credits" ADD COLUMN     "sourceReturnId" TEXT;
ALTER TABLE "store_credits" ADD COLUMN     "createdById" TEXT;

UPDATE "store_credits" SET "remainingAmount" = "amount" WHERE "remainingAmount" IS NULL;

ALTER TABLE "store_credits" ALTER COLUMN "remainingAmount" SET NOT NULL;

-- CreateTable
CREATE TABLE "store_credit_redemptions" (
    "id" TEXT NOT NULL,
    "storeCreditId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_credit_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_credits_sourceReturnId_key" ON "store_credits"("sourceReturnId");

-- AddForeignKey
ALTER TABLE "store_credits" ADD CONSTRAINT "store_credits_sourceReturnId_fkey" FOREIGN KEY ("sourceReturnId") REFERENCES "sales_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credits" ADD CONSTRAINT "store_credits_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_redemptions" ADD CONSTRAINT "store_credit_redemptions_storeCreditId_fkey" FOREIGN KEY ("storeCreditId") REFERENCES "store_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_redemptions" ADD CONSTRAINT "store_credit_redemptions_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
