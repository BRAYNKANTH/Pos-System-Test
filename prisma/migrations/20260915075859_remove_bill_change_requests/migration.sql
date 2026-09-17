-- DropTable
-- The bill change request workflow (correction/refund/void submitted for
-- admin approval) was removed in favor of a future card-scan system;
-- direct void (Bill.status / VoidSaleButton) is unaffected and unrelated.
DROP TABLE "bill_change_requests";
