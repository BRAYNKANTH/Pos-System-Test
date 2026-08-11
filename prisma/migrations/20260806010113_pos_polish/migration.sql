-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "shipping" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "payment_tenders" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payment_tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "held_carts" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "customerId" TEXT,
    "lines" JSONB NOT NULL,
    "discount" JSONB,
    "shipping" DECIMAL(12,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "held_carts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_tenders" ADD CONSTRAINT "payment_tenders_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_carts" ADD CONSTRAINT "held_carts_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_carts" ADD CONSTRAINT "held_carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
