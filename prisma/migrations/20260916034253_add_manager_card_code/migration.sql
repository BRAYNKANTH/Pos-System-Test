-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cardCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_cardCode_key" ON "users"("cardCode");
