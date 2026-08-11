// Seeds enough data to log in and ring up a sale immediately after a fresh
// migration. Safe to re-run — everything is upserted.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS } from "../lib/auth/rbac";

const prisma = new PrismaClient();

async function main() {
  // ── Admin user ──────────────────────────────────────────────────────
  const adminPasswordHash = await bcrypt.hash("Admin123!", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@pos.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@pos.local",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  const cashierPasswordHash = await bcrypt.hash("Cashier123!", 10);
  await prisma.user.upsert({
    where: { email: "cashier@pos.local" },
    update: {},
    create: {
      name: "Cashier",
      email: "cashier@pos.local",
      passwordHash: cashierPasswordHash,
      role: "CASHIER",
    },
  });

  // Reference users from the screenshot
  const defaultPasswordHash = await bcrypt.hash("User123!", 10);
  await prisma.user.upsert({
    where: { email: "nila@gmail.com" },
    update: {},
    create: {
      name: "nila",
      email: "nila@gmail.com",
      passwordHash: defaultPasswordHash,
      role: "CASHIER",
    },
  });

  await prisma.user.upsert({
    where: { email: "mathu@gmail.com" },
    update: {},
    create: {
      name: "mathu",
      email: "mathu@gmail.com",
      passwordHash: defaultPasswordHash,
      role: "CASHIER",
    },
  });

  await prisma.user.upsert({
    where: { email: "Msadmin@gmail.com" },
    update: {},
    create: {
      name: "Mektas Supers",
      email: "Msadmin@gmail.com",
      passwordHash: defaultPasswordHash,
      role: "ADMIN",
    },
  });

  // ── Role permissions (mirrors lib/auth/rbac.ts DEFAULT_GRANTS) ──────
  const grants: Record<string, string[]> = {
    ADMIN: Object.values(PERMISSIONS),
    MANAGER: [
      PERMISSIONS.BILLS_REQUEST_CHANGE,
      PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.INVENTORY_TRANSFER,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_CREATE,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.EXPENSE_VIEW,
      PERMISSIONS.EXPENSE_CREATE,
      PERMISSIONS.REGISTER_OPEN,
      PERMISSIONS.REGISTER_CLOSE,
      PERMISSIONS.REGISTER_VIEW,
      PERMISSIONS.SALES_RETURN_VIEW,
      PERMISSIONS.SALES_RETURN_CREATE,
      PERMISSIONS.QUOTATION_VIEW,
      PERMISSIONS.QUOTATION_CREATE,
      PERMISSIONS.SHIPMENT_MANAGE,
    ],
    CASHIER: [
      PERMISSIONS.BILLS_REQUEST_CHANGE,
      PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.EXPENSE_CREATE,
      PERMISSIONS.REGISTER_OPEN,
      PERMISSIONS.REGISTER_CLOSE,
      PERMISSIONS.REGISTER_VIEW,
      PERMISSIONS.SALES_RETURN_CREATE,
      PERMISSIONS.QUOTATION_CREATE,
    ],
  };
  for (const [role, permissions] of Object.entries(grants)) {
    for (const permissionKey of permissions) {
      await prisma.rolePermission.upsert({
        where: { role_permissionKey: { role: role as never, permissionKey } },
        update: {},
        create: { role: role as never, permissionKey },
      });
    }
  }

  // ── Sample inventory / product catalog ───────────────────────────────
  // Spread across categories/brands so the POS screen's filter chips have
  // something real to show.
  const items = [
    { sku: "SKU-001", name: "Espresso", category: "Beverages", brand: "House Blend", unitPrice: 350, qtyOnHand: 200, lowStockThreshold: 20 },
    { sku: "SKU-002", name: "Cappuccino", category: "Beverages", brand: "House Blend", unitPrice: 450, qtyOnHand: 200, lowStockThreshold: 20 },
    { sku: "SKU-003", name: "Croissant", category: "Bakery", brand: "In-House", unitPrice: 300, qtyOnHand: 60, lowStockThreshold: 10 },
    { sku: "SKU-004", name: "Bottled Water 500ml", category: "Beverages", brand: "AquaPure", unitPrice: 150, qtyOnHand: 300, lowStockThreshold: 30 },
    { sku: "SKU-005", name: "House Blend Beans 250g", category: "Groceries", brand: "House Blend", unitPrice: 1200, qtyOnHand: 40, lowStockThreshold: 5 },
    { sku: "SKU-006", name: "Blueberry Muffin", category: "Bakery", brand: "In-House", unitPrice: 280, qtyOnHand: 45, lowStockThreshold: 10 },
    { sku: "SKU-007", name: "Orange Juice 1L", category: "Beverages", brand: "Citrus Co", unitPrice: 500, qtyOnHand: 80, lowStockThreshold: 15 },
    { sku: "SKU-008", name: "Potato Chips 150g", category: "Snacks", brand: "CrispCo", unitPrice: 220, qtyOnHand: 120, lowStockThreshold: 20 },
    // Reference products from user's discounts screenshot
    { sku: "4796029060175", name: "Detergent powder 1kg alpha light", category: "Laundry", brand: "Alpha", unitPrice: 380, qtyOnHand: 150, lowStockThreshold: 15 },
    { sku: "4796029060403", name: "Detergent powder - alpha 500g", category: "Laundry", brand: "Alpha", unitPrice: 200, qtyOnHand: 150, lowStockThreshold: 15 },
    { sku: "amartha", name: "Amartha Incense sticks", category: "Pooja Items", brand: "Amartha", unitPrice: 60, qtyOnHand: 300, lowStockThreshold: 20 },
    { sku: "10230091", name: "Anchor newdale", category: "Dairy", brand: "Anchor", unitPrice: 110, qtyOnHand: 250, lowStockThreshold: 20 },
    { sku: "479178002370", name: "Aroma Jasmine 400g", category: "Cosmetics", brand: "Aroma", unitPrice: 450, qtyOnHand: 100, lowStockThreshold: 10 },
    { sku: "4792178002349", name: "Aroma Rose 400g", category: "Cosmetics", brand: "Aroma", unitPrice: 450, qtyOnHand: 100, lowStockThreshold: 10 },
  ];
  for (const item of items) {
    await prisma.inventoryItem.upsert({
      where: { sku: item.sku },
      update: { name: item.name, category: item.category, brand: item.brand, unitPrice: item.unitPrice },
      create: item,
    });
  }

  // ── Default location ────────────────────────────────────────────────
  // Every existing InventoryItem row predates multi-location support —
  // its qtyOnHand is attributed in full to this one location, seeded
  // once. Stock Transfers move quantity out of/into LocationStock rows
  // from here without ever touching the InventoryItem total.
  const defaultLocation = await prisma.location.upsert({
    where: { code: "BL0001" },
    update: {},
    create: {
      name: "Mektas Supers",
      code: "BL0001",
      city: "Jaffna",
      country: "Sri Lanka",
      landmark: "Near Clock Tower",
      isDefault: true,
    },
  });

  for (const item of items) {
    await prisma.locationStock.upsert({
      where: { locationId_sku: { locationId: defaultLocation.id, sku: item.sku } },
      update: {},
      create: { locationId: defaultLocation.id, sku: item.sku, qty: item.qtyOnHand },
    });
  }

  // ── Sample suppliers ─────────────────────────────────────────────────
  await prisma.supplier.upsert({
    where: { email: "orders@citruscoltd.lk" },
    update: {},
    create: { name: "Citrus Co Distributors", email: "orders@citruscoltd.lk", phone: "0771234567" },
  });
  await prisma.supplier.upsert({
    where: { email: "sales@alphahousehold.lk" },
    update: {},
    create: { name: "Alpha Household Supplies", email: "sales@alphahousehold.lk", phone: "0779876543" },
  });

  // ── Tax rule ─────────────────────────────────────────────────────────
  await prisma.taxRule.upsert({
    where: { id: "default-tax-rule" },
    update: { isDefault: true },
    create: {
      id: "default-tax-rule",
      name: "Standard Tax",
      region: "default",
      category: "default",
      rate: 0.08,
      rateType: "Percentage",
      isDefault: true,
    },
  });

  // ── Business / invoice / barcode settings (singleton rows) ───────────
  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", data: { bizName: "Mektas Supers", bizCurrency: "Sri Lanka - Rupees(LKR)" } },
  });
  await prisma.invoiceSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", data: {} },
  });
  await prisma.barcodeSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  // ── Approval threshold (inventory adjustments over 20 units need approval) ──
  await prisma.approvalThreshold.upsert({
    where: { id: "default-inventory-threshold" },
    update: {},
    create: {
      id: "default-inventory-threshold",
      scope: "default",
      thresholdType: "absolute",
      value: 20,
    },
  });

  // ── Seed discounts from screenshot ────────────────────────────────────
  const sampleDiscounts = [
    {
      id: "disc-1",
      name: "Alpha 1kg",
      startsAt: new Date("2026-05-07T09:32:00Z"),
      endsAt: new Date("2026-07-31T09:32:00Z"),
      discountType: "Fixed",
      discountAmount: 70.0,
      priority: 1,
      brand: "",
      category: "",
      products: [
        { sku: "4796029060175", name: "Detergent powder 1kg alpha light" }
      ],
      location: "Mektas Supers",
      sellingPriceGroup: "All",
      applyInCustomerGroups: false,
      isActive: true,
    },
    {
      id: "disc-2",
      name: "Alpha Light",
      startsAt: new Date("2026-05-06T15:55:00Z"),
      endsAt: new Date("2026-11-05T15:55:00Z"),
      discountType: "Fixed",
      discountAmount: 60.0,
      priority: 1,
      brand: "",
      category: "",
      products: [
        { sku: "4796029060403", name: "Detergent powder - alpha 500g" }
      ],
      location: "Mektas Supers",
      sellingPriceGroup: "All",
      applyInCustomerGroups: false,
      isActive: true,
    },
    {
      id: "disc-3",
      name: "AMARTHA",
      startsAt: new Date("2026-05-04T08:11:00Z"),
      endsAt: new Date("2027-06-15T08:11:00Z"),
      discountType: "Fixed",
      discountAmount: 30.0,
      priority: 1,
      brand: "",
      category: "",
      products: [
        { sku: "amartha", name: "Amartha Incense sticks" }
      ],
      location: "Mektas Supers",
      sellingPriceGroup: "All",
      applyInCustomerGroups: false,
      isActive: true,
    },
    {
      id: "disc-4",
      name: "Anchor Newdle",
      startsAt: new Date("2026-07-26T10:55:00Z"),
      endsAt: new Date("2027-10-15T10:56:00Z"),
      discountType: "Fixed",
      discountAmount: 20.0,
      priority: 1,
      brand: "",
      category: "",
      products: [
        { sku: "10230091", name: "Anchor newdale" }
      ],
      location: "Mektas Supers",
      sellingPriceGroup: "All",
      applyInCustomerGroups: false,
      isActive: true,
    },
    {
      id: "disc-5",
      name: "Aroma",
      startsAt: new Date("2026-05-12T14:42:00Z"),
      endsAt: new Date("2026-07-31T14:42:00Z"),
      discountType: "Fixed",
      discountAmount: 5.0,
      priority: 1,
      brand: "",
      category: "",
      products: [
        { sku: "479178002370", name: "Aroma Jasmine 400g" }
      ],
      location: "Mektas Supers",
      sellingPriceGroup: "All",
      applyInCustomerGroups: false,
      isActive: true,
    },
    {
      id: "disc-6",
      name: "Aroma",
      startsAt: new Date("2026-05-12T14:42:00Z"),
      endsAt: new Date("2026-07-31T14:42:00Z"),
      discountType: "Fixed",
      discountAmount: 5.0,
      priority: 1,
      brand: "",
      category: "",
      products: [
        { sku: "4792178002349", name: "Aroma Rose 400g" }
      ],
      location: "Mektas Supers",
      sellingPriceGroup: "All",
      applyInCustomerGroups: false,
      isActive: true,
    },
  ];

  for (const disc of sampleDiscounts) {
    await prisma.discount.upsert({
      where: { id: disc.id },
      update: {
        name: disc.name,
        startsAt: disc.startsAt,
        endsAt: disc.endsAt,
        discountType: disc.discountType,
        discountAmount: disc.discountAmount,
        priority: disc.priority,
        brand: disc.brand,
        category: disc.category,
        products: disc.products,
        location: disc.location,
        sellingPriceGroup: disc.sellingPriceGroup,
        applyInCustomerGroups: disc.applyInCustomerGroups,
        isActive: disc.isActive,
      },
      create: disc,
    });
  }

  console.log("Seeded:");
  console.log("  Admin login:   admin@pos.local / Admin123!");
  console.log("  Cashier login: cashier@pos.local / Cashier123!");
  console.log(`  ${items.length} inventory items, ${sampleDiscounts.length} discounts, 1 tax rule, 1 approval threshold`);
  console.log(`  Admin user id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
