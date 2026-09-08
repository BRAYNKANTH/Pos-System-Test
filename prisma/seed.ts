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
      name: "Helan Motors Admin",
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
      PERMISSIONS.REPORTS_AUDIT_VIEW,
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
      PERMISSIONS.PRICE_OVERRIDE,
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
  // Helan Motors — motor parts & spares. Spread across the shop's 9
  // category groups (Engine, Gear/Clutch, Brakes, Suspension/Steering,
  // Electrical, Cooling, Filters/Lubricants, Body, Rubber) so the POS
  // screen's filter chips have something real to show. Fitment (which
  // vehicle a part suits) is kept in the name text rather than a
  // dedicated field — good enough for a flat parts catalog without a
  // schema change; revisit with a real VehicleCompatibility model if the
  // shop later wants fitment search/filtering.
  const items = [
    // Engine Components
    { sku: "ENG-001", name: "Piston Ring Set - Toyota 2C Diesel", category: "Engine Components", brand: "Teikin", unitPrice: 4500, qtyOnHand: 25, lowStockThreshold: 5 },
    { sku: "ENG-002", name: "Cylinder Head Gasket - Nissan TD27", category: "Engine Components", brand: "Ishino Stone", unitPrice: 3200, qtyOnHand: 15, lowStockThreshold: 5 },
    { sku: "ENG-003", name: "Main Bearing Set - Mitsubishi 4D56", category: "Engine Components", brand: "Daido", unitPrice: 5800, qtyOnHand: 10, lowStockThreshold: 3 },
    // Gear and Clutch Parts
    { sku: "GRB-001", name: "Clutch Plate & Cover Kit - Toyota Hiace", category: "Gear and Clutch Parts", brand: "Exedy", unitPrice: 12500, qtyOnHand: 8, lowStockThreshold: 2 },
    { sku: "GRB-002", name: "Propeller Shaft Center Bearing", category: "Gear and Clutch Parts", brand: "NSK", unitPrice: 3800, qtyOnHand: 12, lowStockThreshold: 4 },
    { sku: "GRB-003", name: "Clutch Release Bearing", category: "Gear and Clutch Parts", brand: "NSK", unitPrice: 1500, qtyOnHand: 30, lowStockThreshold: 8 },
    // Brake System
    { sku: "BRK-001", name: "Brake Pad Set - Toyota Hiace", category: "Brake System", brand: "Akebono", unitPrice: 4200, qtyOnHand: 20, lowStockThreshold: 6 },
    { sku: "BRK-002", name: "Brake Drum - Front", category: "Brake System", brand: "Universal", unitPrice: 6800, qtyOnHand: 6, lowStockThreshold: 2 },
    { sku: "BRK-003", name: "Brake Master Cylinder Repair Kit", category: "Brake System", brand: "Wabco", unitPrice: 2200, qtyOnHand: 15, lowStockThreshold: 5 },
    // Suspension and Steering
    { sku: "SUS-001", name: "Shock Absorber - Front", category: "Suspension and Steering", brand: "KYB", unitPrice: 5500, qtyOnHand: 14, lowStockThreshold: 4 },
    { sku: "SUS-002", name: "Power Steering Pump", category: "Suspension and Steering", brand: "Bosch", unitPrice: 15800, qtyOnHand: 4, lowStockThreshold: 2 },
    { sku: "SUS-003", name: "Ball Joint", category: "Suspension and Steering", brand: "555", unitPrice: 1800, qtyOnHand: 25, lowStockThreshold: 8 },
    // Electrical Systems
    { sku: "ELE-001", name: "Starter Motor - Toyota Hiace", category: "Electrical Systems", brand: "Denso", unitPrice: 22000, qtyOnHand: 5, lowStockThreshold: 2, trackSerial: true },
    { sku: "ELE-002", name: "Alternator - Nissan", category: "Electrical Systems", brand: "Hitachi", unitPrice: 24500, qtyOnHand: 4, lowStockThreshold: 2, trackSerial: true },
    { sku: "ELE-003", name: "Car Battery 12V 65Ah", category: "Electrical Systems", brand: "Amaron", unitPrice: 18500, qtyOnHand: 10, lowStockThreshold: 3 },
    { sku: "ELE-004", name: "Headlamp Bulb H4", category: "Electrical Systems", brand: "Philips", unitPrice: 850, qtyOnHand: 60, lowStockThreshold: 15 },
    // Cooling Systems
    { sku: "COOL-001", name: "Radiator - Toyota Hiace", category: "Cooling Systems", brand: "Denso", unitPrice: 13500, qtyOnHand: 6, lowStockThreshold: 2 },
    { sku: "COOL-002", name: "Water Pump", category: "Cooling Systems", brand: "GMB", unitPrice: 4800, qtyOnHand: 12, lowStockThreshold: 4 },
    { sku: "COOL-003", name: "Radiator Hose Set", category: "Cooling Systems", brand: "Universal", unitPrice: 2200, qtyOnHand: 18, lowStockThreshold: 5 },
    // Filters and Lubricants
    { sku: "FIL-001", name: "Oil Filter", category: "Filters and Lubricants", brand: "Sakura", unitPrice: 650, qtyOnHand: 80, lowStockThreshold: 20 },
    { sku: "FIL-002", name: "Air Filter", category: "Filters and Lubricants", brand: "Sakura", unitPrice: 950, qtyOnHand: 50, lowStockThreshold: 15 },
    { sku: "FIL-003", name: "Engine Oil 20W-50 4L", category: "Filters and Lubricants", brand: "Castrol", unitPrice: 5200, qtyOnHand: 40, lowStockThreshold: 10 },
    { sku: "FIL-004", name: "Engine Oil 20W-50 1L", category: "Filters and Lubricants", brand: "Castrol", unitPrice: 1400, qtyOnHand: 60, lowStockThreshold: 15 },
    // Body Parts
    { sku: "BOD-001", name: "Front Bumper - Toyota Hiace", category: "Body Parts", brand: "Universal", unitPrice: 18500, qtyOnHand: 3, lowStockThreshold: 1 },
    { sku: "BOD-002", name: "Side Mirror Assembly", category: "Body Parts", brand: "Universal", unitPrice: 3200, qtyOnHand: 10, lowStockThreshold: 3 },
    { sku: "BOD-003", name: "Door Handle Set", category: "Body Parts", brand: "Universal", unitPrice: 1600, qtyOnHand: 20, lowStockThreshold: 6 },
    // Rubber Parts
    { sku: "RUB-001", name: "Engine Mounting Rubber", category: "Rubber Parts", brand: "Universal", unitPrice: 2800, qtyOnHand: 15, lowStockThreshold: 5 },
    { sku: "RUB-002", name: "Wiper Blade Set", category: "Rubber Parts", brand: "Bosch", unitPrice: 1200, qtyOnHand: 25, lowStockThreshold: 8 },
    { sku: "RUB-003", name: "Door Rubber Seal", category: "Rubber Parts", brand: "Universal", unitPrice: 1800, qtyOnHand: 12, lowStockThreshold: 4 },
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
    where: { code: "HM0001" },
    update: {},
    create: {
      name: "Helan Motors",
      code: "HM0001",
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
    where: { email: "orders@laknaautoparts.lk" },
    update: {},
    create: { name: "Lakna Auto Parts Distributors", email: "orders@laknaautoparts.lk", phone: "0771234567" },
  });
  await prisma.supplier.upsert({
    where: { email: "sales@ceylonspares.lk" },
    update: {},
    create: { name: "Ceylon Spares & Accessories", email: "sales@ceylonspares.lk", phone: "0779876543" },
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
    create: { id: "default", data: { bizName: "Helan Motors", bizCurrency: "Sri Lanka - Rupees(LKR)" } },
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

  // ── Seed discounts ───────────────────────────────────────────────────
  const sampleDiscounts = [
    {
      id: "disc-1",
      name: "Engine Oil 4L Promo",
      startsAt: new Date("2026-05-07T09:32:00Z"),
      endsAt: new Date("2026-12-31T09:32:00Z"),
      discountType: "Fixed",
      discountAmount: 300.0,
      priority: 1,
      brand: "",
      category: "",
      products: [
        { sku: "FIL-003", name: "Engine Oil 20W-50 4L" }
      ],
      location: "Helan Motors",
      sellingPriceGroup: "All",
      applyInCustomerGroups: false,
      isActive: true,
    },
    {
      id: "disc-2",
      name: "Brake Pad Special",
      startsAt: new Date("2026-05-06T15:55:00Z"),
      endsAt: new Date("2026-11-05T15:55:00Z"),
      discountType: "Fixed",
      discountAmount: 400.0,
      priority: 1,
      brand: "",
      category: "",
      products: [
        { sku: "BRK-001", name: "Brake Pad Set - Toyota Hiace" }
      ],
      location: "Helan Motors",
      sellingPriceGroup: "All",
      applyInCustomerGroups: false,
      isActive: true,
    },
    {
      id: "disc-3",
      name: "Battery Trade-in Discount",
      startsAt: new Date("2026-05-04T08:11:00Z"),
      endsAt: new Date("2027-06-15T08:11:00Z"),
      discountType: "Fixed",
      discountAmount: 1000.0,
      priority: 1,
      brand: "",
      category: "",
      products: [
        { sku: "ELE-003", name: "Car Battery 12V 65Ah" }
      ],
      location: "Helan Motors",
      sellingPriceGroup: "All",
      applyInCustomerGroups: false,
      isActive: true,
    },
    {
      id: "disc-4",
      name: "Filters & Lubricants Category Discount",
      startsAt: new Date("2026-05-12T14:42:00Z"),
      endsAt: new Date("2026-12-31T14:42:00Z"),
      discountType: "Percentage",
      discountAmount: 5.0,
      priority: 2,
      brand: "",
      category: "Filters and Lubricants",
      products: [],
      location: "Helan Motors",
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
