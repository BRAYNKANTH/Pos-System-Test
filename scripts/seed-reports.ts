import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding reports tables...");

  // 1. Seed Expenses
  await prisma.expense.createMany({
    data: [
      { category: "Rent & Utilities", details: "Warehouse & Head office monthly payment", status: "Completed", amount: 25000 },
      { category: "Staff Salaries", details: "July cashier and staff payout", status: "Completed", amount: 15000 },
      { category: "Stationery & Consumables", details: "Thermal receipt paper rolls purchase", status: "Completed", amount: 2500 },
      { category: "Marketing", details: "Local newspaper ads and flyers", status: "Completed", amount: 4500 },
      { category: "Repairs", details: "Fixing air conditioning unit in location A", status: "Completed", amount: 8000 },
    ],
  });

  // 2. Seed Suppliers
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { email: "info@ceylonteadist.lk" },
      update: {},
      create: { name: "Ceylon Tea Distributors", email: "info@ceylonteadist.lk", phone: "011-2345678" },
    }),
    prisma.supplier.upsert({
      where: { email: "orders@lankaretail.lk" },
      update: {},
      create: { name: "Lanka Retail Wholesalers", email: "orders@lankaretail.lk", phone: "011-8765432" },
    }),
    prisma.supplier.upsert({
      where: { email: "sales@possupplies.lk" },
      update: {},
      create: { name: "POS Supplies Ltd", email: "sales@possupplies.lk", phone: "011-5555555" },
    }),
  ]);

  // 3. Seed Purchases (linked to supplier id)
  await prisma.purchase.createMany({
    data: [
      { supplierId: suppliers[0].id, referenceNo: "PAY-SUP-091", paymentMethod: "Bank Transfer", status: "Completed", amountPaid: 95400 },
      { supplierId: suppliers[1].id, referenceNo: "PAY-SUP-092", paymentMethod: "Cheque", status: "Pending", amountPaid: 140000 },
      { supplierId: suppliers[1].id, referenceNo: "PAY-SUP-093", paymentMethod: "Bank Transfer", status: "Completed", amountPaid: 98000 },
      { supplierId: suppliers[2].id, referenceNo: "PAY-SUP-094", paymentMethod: "Cash", status: "Completed", amountPaid: 12500 },
    ],
  });

  // 4. Update existing Customers to assign groups
  const customers = await prisma.customer.findMany();
  const groups = ["Retail / Walk-In", "Wholesale Members", "VIP / Loyalty Members"];
  for (let i = 0; i < customers.length; i++) {
    const groupName = groups[i % groups.length];
    await prisma.customer.update({
      where: { id: customers[i].id },
      data: { group: groupName },
    });
  }

  // 5. Update existing InventoryItems to assign expiryDate
  const items = await prisma.inventoryItem.findMany();
  const today = new Date();
  for (let i = 0; i < items.length; i++) {
    const expiry = new Date();
    if (i % 3 === 0) {
      expiry.setDate(today.getDate() - 15); // Expired
    } else if (i % 3 === 1) {
      expiry.setDate(today.getDate() + 45); // Near expiry
    } else {
      expiry.setDate(today.getDate() + 320); // Good
    }
    await prisma.inventoryItem.update({
      where: { id: items[i].id },
      data: { expiryDate: expiry },
    });
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
