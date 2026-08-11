import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { notFound, redirect } from "next/navigation";
import ReportClient from "./ReportClient";

export const dynamic = "force-dynamic";

interface SummaryCard {
  label: string;
  value: string;
  desc?: string;
}

interface ChartItem {
  name: string;
  value: number;
}

interface ReportData {
  title: string;
  description: string;
  type: string;
  headers: string[];
  rows: Record<string, any>[];
  summaryCards: SummaryCard[];
  chartData: ChartItem[];
  
  // Custom P&L metrics and tab data
  plMetrics?: Record<string, number>;
  plTabsData?: Record<string, { name: string; grossProfit: number }[]>;
}

const REPORT_TYPES = [
  "profit-loss",
  "purchase-sale",
  "tax",
  "supplier-customer",
  "customer-groups",
  "stock",
  "stock-expiry",
  "stock-adjustment",
  "stock-transfer",
  "trending-products",
  "items",
  "product-purchase",
  "product-sell",
  "purchase-payment",
  "sell-payment",
  "expense",
  "register",
  "sales-representative",
];

export default async function ReportPage({ params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const allowed = await checkPermission(user.role, PERMISSIONS.REPORTS_VIEW);
  if (!allowed) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-6 py-16">
        <h1 className="text-xl font-semibold text-zinc-800">Access Denied</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have permission to view system reports.</p>
      </main>
    );
  }

  const { type } = await params;
  if (!REPORT_TYPES.includes(type)) {
    notFound();
  }

  // --- QUERY & AGGREGATE DATA BASED ON REPORT TYPE ---
  let title = "";
  let description = "";
  let headers: string[] = [];
  let rows: Record<string, any>[] = [];
  let summaryCards: SummaryCard[] = [];
  let chartData: ChartItem[] = [];
  let plMetrics: Record<string, number> | undefined = undefined;
  let plTabsData: Record<string, { name: string; grossProfit: number }[]> | undefined = undefined;

  const currencyFmt = (val: number) => `Rs ${val.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  switch (type) {
    case "profit-loss": {
      title = "Profit / Loss Report";
      description = "Gross and net profit calculations based on transactions, cost of goods, and expenses.";
      
      // 1. Query all necessary tables from the database
      const inventoryItems = await prisma.inventoryItem.findMany();
      const transactions = await prisma.transaction.findMany({
        where: { status: "completed" },
        include: { items: true, cashier: true, customer: true },
      });
      const adjustments = await prisma.stockAdjustment.findMany({
        where: { status: "applied" },
      });
      const expenses = await prisma.expense.findMany();
      const purchases = await prisma.purchase.findMany({
        where: { status: "Completed" },
      });

      // 2. Map data for SKU based metrics calculation
      const soldQtyMap = new Map<string, number>();
      const discountMap = new Map<string, number>();
      const salesValMap = new Map<string, number>();
      const addedQtyMap = new Map<string, number>();
      const removedQtyMap = new Map<string, number>();

      for (const tx of transactions) {
        for (const item of tx.items) {
          soldQtyMap.set(item.sku, (soldQtyMap.get(item.sku) || 0) + item.qty);
          discountMap.set(item.sku, (discountMap.get(item.sku) || 0) + Number(item.discount));
          const grossVal = Number(item.unitPrice) * item.qty;
          salesValMap.set(item.sku, (salesValMap.get(item.sku) || 0) + grossVal);
        }
      }

      for (const adj of adjustments) {
        if (adj.qtyChange > 0) {
          addedQtyMap.set(adj.sku, (addedQtyMap.get(adj.sku) || 0) + adj.qtyChange);
        } else {
          removedQtyMap.set(adj.sku, (removedQtyMap.get(adj.sku) || 0) + Math.abs(adj.qtyChange));
        }
      }

      // Collect all unique SKUs across inventory, transactions, and adjustments
      const allSkus = new Set([
        ...inventoryItems.map((i) => i.sku),
        ...soldQtyMap.keys(),
        ...addedQtyMap.keys(),
        ...removedQtyMap.keys(),
      ]);

      let totalOpeningStockPurchase = 0;
      let totalOpeningStockSale = 0;
      let totalClosingStockPurchase = 0;
      let totalClosingStockSale = 0;
      let totalPurchasesVal = purchases.reduce((acc, p) => acc + Number(p.amountPaid), 0);
      let totalStockAdjustmentsVal = 0;
      let totalSalesVal = 0;
      let totalDiscountsVal = 0;
      let totalCogsVal = 0;
      let totalGrossProfitVal = 0;

      const tabProducts: { name: string; grossProfit: number }[] = [];
      const plCategories = new Map<string, number>();
      const plBrands = new Map<string, number>();

      const invMap = new Map(inventoryItems.map((i) => [i.sku, i]));

      // Loop through all SKUs to compute itemized values
      for (const sku of allSkus) {
        const inv = invMap.get(sku);
        const name = inv ? inv.name : sku;
        const price = inv ? Number(inv.unitPrice) : 0;
        const cost = inv && Number(inv.purchasePrice) > 0 ? Number(inv.purchasePrice) : price * 0.8;
        const category = inv?.category || "Uncategorized";
        const brand = inv?.brand || "Unbranded";

        const closingQty = inv ? inv.qtyOnHand : 0;
        const soldQty = soldQtyMap.get(sku) || 0;
        const addedQty = addedQtyMap.get(sku) || 0;
        const removedQty = removedQtyMap.get(sku) || 0;
        
        // Opening Stock Qty = Closing Stock Qty + Sold Qty - Added Qty + Removed Qty
        const openingQty = Math.max(0, closingQty + soldQty - addedQty + removedQty);

        const openingCost = openingQty * cost;
        const openingSale = openingQty * price;
        const closingCost = closingQty * cost;
        const closingSale = closingQty * price;
        const purchase = addedQty * cost;
        const adjustment = removedQty * cost;
        const sales = salesValMap.get(sku) || 0;
        const discount = discountMap.get(sku) || 0;

        // COGS = Starting Inventory (Opening Stock) + Purchases - Ending Inventory (Closing Stock)
        const cogs = openingCost + purchase - closingCost;
        const itemNetSales = sales - discount;
        const itemGrossProfit = itemNetSales - cogs;

        totalOpeningStockPurchase += openingCost;
        totalOpeningStockSale += openingSale;
        totalClosingStockPurchase += closingCost;
        totalClosingStockSale += closingSale;
        // purchasesVal from positive stock adjustments is a fallback helper; we overwrite totalPurchasesVal with actual purchases ledger sum below if preferred, but keep both aligned:
        if (totalPurchasesVal === 0) {
          totalPurchasesVal += purchase;
        }
        totalStockAdjustmentsVal += adjustment;
        totalSalesVal += sales;
        totalDiscountsVal += discount;
        totalCogsVal += cogs;
        totalGrossProfitVal += itemGrossProfit;

        tabProducts.push({ name, grossProfit: itemGrossProfit });
        plCategories.set(category, (plCategories.get(category) || 0) + itemGrossProfit);
        plBrands.set(brand, (plBrands.get(brand) || 0) + itemGrossProfit);
      }

      // Calculate Total Expense
      const totalExpense = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
      const totalSellShipping = transactions.reduce((acc, t) => acc + Number(t.shipping), 0);

      // Formulas calculations based strictly on database values
      const netProfit = totalGrossProfitVal + totalSellShipping - (totalStockAdjustmentsVal + totalDiscountsVal + totalExpense);

      plMetrics = {
        openingStockPurchase: totalOpeningStockPurchase,
        openingStockSale: totalOpeningStockSale,
        totalPurchase: totalPurchasesVal,
        totalStockAdjustment: totalStockAdjustmentsVal,
        totalExpense,
        totalPurchaseShipping: 0.00,
        purchaseAdditionalExpenses: 0.00,
        totalTransferShipping: 0.00,
        totalSellDiscount: totalDiscountsVal,
        totalCustomerReward: 0.00,
        totalSellReturn: 0.00,
        closingStockPurchase: totalClosingStockPurchase,
        closingStockSale: totalClosingStockSale,
        totalSales: totalSalesVal,
        totalSellShipping,
        sellAdditionalExpenses: 0.00,
        totalStockRecovered: 0.00,
        totalPurchaseReturn: 0.00,
        totalPurchaseDiscount: 0.00,
        totalSellRoundOff: 0.00,
        cogs: totalCogsVal,
        grossProfit: totalGrossProfitVal,
        netProfit,
      };

      // 3. Tabulations for non-product groupings
      const tabCategories = [...plCategories.entries()].map(([name, gp]) => ({ name, grossProfit: gp }));
      const tabBrands = [...plBrands.entries()].map(([name, gp]) => ({ name, grossProfit: gp }));

      // Pre-calculate actual gross profit per transaction using database cost
      const txGrossMap = new Map<string, number>();
      for (const tx of transactions) {
        const costSum = tx.items.reduce((acc, item) => {
          const inv = invMap.get(item.sku);
          const cost = inv && Number(inv.purchasePrice) > 0 ? Number(inv.purchasePrice) : Number(item.unitPrice) * 0.8;
          return acc + (cost * item.qty);
        }, 0);
        const txGross = Number(tx.total) - costSum;
        txGrossMap.set(tx.id, txGross);
      }

      // Locations
      const plLocations = new Map<string, number>();
      for (const tx of transactions) {
        const txGross = txGrossMap.get(tx.id) || 0;
        plLocations.set(tx.registerId, (plLocations.get(tx.registerId) || 0) + txGross);
      }
      const tabLocations = plLocations.size > 0 
        ? [...plLocations.entries()].map(([name, gp]) => ({ name, grossProfit: gp }))
        : [{ name: "Mektas Supers", grossProfit: totalGrossProfitVal }];

      // Invoices
      const tabInvoices = transactions.map((tx) => {
        const txGross = txGrossMap.get(tx.id) || 0;
        return { name: tx.id, grossProfit: txGross };
      });

      // Dates
      const plDates = new Map<string, number>();
      for (const tx of transactions) {
        const dateStr = tx.createdAt.toLocaleDateString("en-GB").replace(/\//g, "-");
        const txGross = txGrossMap.get(tx.id) || 0;
        plDates.set(dateStr, (plDates.get(dateStr) || 0) + txGross);
      }
      const tabDates = [...plDates.entries()].map(([name, gp]) => ({ name, grossProfit: gp }));

      // Customers
      const plCustomers = new Map<string, number>();
      for (const tx of transactions) {
        const cName = tx.customer?.name || "Walk-in Customer";
        const txGross = txGrossMap.get(tx.id) || 0;
        plCustomers.set(cName, (plCustomers.get(cName) || 0) + txGross);
      }
      const tabCustomers = [...plCustomers.entries()].map(([name, gp]) => ({ name, grossProfit: gp }));

      // Days of the Week
      const plDays = new Map<string, number>();
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      for (const tx of transactions) {
        const dayName = dayNames[tx.createdAt.getDay()];
        const txGross = txGrossMap.get(tx.id) || 0;
        plDays.set(dayName, (plDays.get(dayName) || 0) + txGross);
      }
      const tabDays = [...plDays.entries()].map(([name, gp]) => ({ name, grossProfit: gp }));

      // Cashiers / Staff
      const plStaff = new Map<string, number>();
      for (const tx of transactions) {
        const sName = tx.cashier.name;
        const txGross = txGrossMap.get(tx.id) || 0;
        plStaff.set(sName, (plStaff.get(sName) || 0) + txGross);
      }
      const tabStaff = [...plStaff.entries()].map(([name, gp]) => ({ name, grossProfit: gp }));

      plTabsData = {
        products: tabProducts,
        categories: tabCategories,
        brands: tabBrands,
        locations: tabLocations,
        invoices: tabInvoices,
        dates: tabDates,
        customers: tabCustomers,
        days: tabDays,
        staff: tabStaff,
      };
      break;
    }

    case "purchase-sale": {
      title = "Purchase & Sale Report";
      description = "Comparison of purchase costs versus sales revenues.";
      headers = ["Period / Metric", "Purchase Value", "Sale Value", "Balance"];

      const transactions = await prisma.transaction.findMany({
        where: { status: "completed" },
      });

      const totalSales = transactions.reduce((acc, t) => acc + Number(t.total), 0);
      const purchases = await prisma.purchase.findMany({ where: { status: "Completed" } });
      const purchaseEst = purchases.reduce((acc, p) => acc + Number(p.amountPaid), 0);

      rows = [
        {
          period: "All Time Cumulative",
          purchase: currencyFmt(purchaseEst),
          sale: currencyFmt(totalSales),
          balance: currencyFmt(totalSales - purchaseEst),
        },
      ];

      summaryCards = [
        { label: "Total Purchases", value: currencyFmt(purchaseEst), desc: "Paid to suppliers" },
        { label: "Gross Sales", value: currencyFmt(totalSales), desc: "Total POS revenue" },
        { label: "Net Margin", value: currencyFmt(totalSales - purchaseEst), desc: "Sales minus purchases" },
      ];

      chartData = [
        { name: "Total Purchases", value: purchaseEst },
        { name: "Total Sales", value: totalSales },
      ];
      break;
    }

    case "tax": {
      title = "Tax Report";
      description = "Summary of taxes collected on transactions.";
      headers = ["Transaction ID", "Cashier", "Payment Method", "Subtotal", "Tax Collected", "Total"];

      const transactions = await prisma.transaction.findMany({
        where: { status: "completed" },
        include: { cashier: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      const totalTax = transactions.reduce((acc, t) => acc + Number(t.tax), 0);

      rows = transactions.map((t) => ({
        id: t.id,
        cashier: t.cashier.name,
        method: t.paymentMethod,
        subtotal: currencyFmt(Number(t.subtotal)),
        tax: currencyFmt(Number(t.tax)),
        total: currencyFmt(Number(t.total)),
      }));

      summaryCards = [
        { label: "Total Tax Collected", value: currencyFmt(totalTax), desc: "VAT/GST collections" },
        { label: "Taxable Transactions", value: transactions.length.toString(), desc: "Completed sales with tax records" },
      ];

      chartData = [
        { name: "Taxable Subtotal", value: transactions.reduce((acc, t) => acc + Number(t.subtotal), 0) },
        { name: "Tax Collected", value: totalTax },
      ];
      break;
    }

    case "supplier-customer": {
      title = "Supplier & Customer Report";
      description = "Overview of business transactions with contacts.";
      headers = ["Contact Name", "Contact Details", "Role", "Transactions Count", "Total Transacted Value"];

      // 1. Fetch Customers and their transaction counts
      const customers = await prisma.customer.findMany({
        include: { transactions: true },
      });

      rows = customers.map((c) => {
        const total = c.transactions.reduce((acc, t) => acc + Number(t.total), 0);
        return {
          name: c.name,
          details: c.email || c.phone || "—",
          role: "Customer",
          count: c.transactions.length,
          value: currencyFmt(total),
        };
      });

      // 2. Fetch Suppliers and their purchase counts
      const suppliers = await prisma.supplier.findMany();
      const purchases = await prisma.purchase.findMany({ where: { status: "Completed" } });

      const supplierRows = suppliers.map((s) => {
        const supplierPurchases = purchases.filter((p) => p.supplierId === s.id);
        const totalPaid = supplierPurchases.reduce((acc, p) => acc + Number(p.amountPaid), 0);
        return {
          name: s.name,
          details: s.email || s.phone || "—",
          role: "Supplier",
          count: supplierPurchases.length,
          value: currencyFmt(totalPaid),
        };
      });

      rows = [...rows, ...supplierRows];

      const totalCustomerSales = customers.reduce(
        (acc, c) => acc + c.transactions.reduce((tAcc, t) => tAcc + Number(t.total), 0),
        0
      );

      summaryCards = [
        { label: "Registered Customers", value: customers.length.toString(), desc: "Customer list count" },
        { label: "Registered Suppliers", value: suppliers.length.toString(), desc: "Supplier list count" },
      ];

      chartData = customers.slice(0, 5).map((c) => ({
        name: c.name,
        value: c.transactions.reduce((acc, t) => acc + Number(t.total), 0),
      }));
      break;
    }

    case "customer-groups": {
      title = "Customer Groups Report";
      description = "Sales distribution per customer group profiles.";
      headers = ["Group Name", "Total Customers", "Sales Count", "Total Spent"];

      const customers = await prisma.customer.findMany({
        include: { transactions: true },
      });

      const byGroup = new Map<string, { count: number; sales: number; spent: number }>();
      for (const c of customers) {
        const groupName = c.group || "Retail / Walk-In";
        const existing = byGroup.get(groupName) ?? { count: 0, sales: 0, spent: 0 };
        existing.count++;
        existing.sales += c.transactions.length;
        existing.spent += c.transactions.reduce((acc, t) => acc + Number(t.total), 0);
        byGroup.set(groupName, existing);
      }

      rows = [...byGroup.entries()].map(([group, agg]) => ({
        group,
        count: agg.count,
        sales: agg.sales,
        spent: currencyFmt(agg.spent),
      }));

      const totalCustomerSales = customers.reduce(
        (acc, c) => acc + c.transactions.reduce((tAcc, t) => tAcc + Number(t.total), 0),
        0
      );

      summaryCards = [
        { label: "Active Customer Groups", value: byGroup.size.toString(), desc: "Retail, Wholesale, VIP" },
        { label: "Total Group Sales", value: currencyFmt(totalCustomerSales), desc: "Sum of group customer purchases" },
      ];

      chartData = [...byGroup.entries()].map(([name, agg]) => ({
        name,
        value: agg.spent,
      }));
      break;
    }

    case "stock": {
      title = "Stock Report";
      description = "Real-time list of inventory items and current quantities on hand.";
      headers = ["SKU", "Product Name", "Category", "Unit Price", "Quantity On Hand", "Stock Value"];

      const inventory = await prisma.inventoryItem.findMany({
        orderBy: { qtyOnHand: "asc" },
      });

      rows = inventory.map((i) => ({
        sku: i.sku,
        name: i.name,
        category: i.category || "—",
        price: currencyFmt(Number(i.unitPrice)),
        qty: i.qtyOnHand,
        value: currencyFmt(Number(i.unitPrice) * i.qtyOnHand),
      }));

      const totalStockVal = inventory.reduce((acc, i) => acc + Number(i.unitPrice) * i.qtyOnHand, 0);
      const lowStockCount = inventory.filter((i) => i.qtyOnHand <= i.lowStockThreshold).length;

      summaryCards = [
        { label: "Total Catalog Items", value: inventory.length.toString(), desc: "Products registered" },
        { label: "Total Stock Value", value: currencyFmt(totalStockVal), desc: "Asset value of quantities on hand" },
        { label: "Low Stock Items", value: lowStockCount.toString(), desc: "Quantities below threshold limit" },
      ];

      chartData = inventory.slice(0, 8).map((i) => ({
        name: i.name,
        value: i.qtyOnHand,
      }));
      break;
    }

    case "stock-expiry": {
      title = "Stock Expiry Report";
      description = "Tracking products approaching expiration dates.";
      headers = ["SKU", "Product Name", "Quantity On Hand", "Expiry Date", "Days Remaining", "Status"];

      const inventory = await prisma.inventoryItem.findMany({
        where: { expiryDate: { not: null } },
        orderBy: { expiryDate: "asc" },
      });

      const today = new Date();

      rows = inventory.map((i) => {
        const expiryDate = i.expiryDate!;
        const diffTime = expiryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const status = diffDays < 0 ? "Expired" : diffDays <= 60 ? "Near Expiry" : "Good";

        return {
          sku: i.sku,
          name: i.name,
          qty: i.qtyOnHand,
          expiry: expiryDate.toLocaleDateString("en-GB").replace(/\//g, "-"),
          days: diffDays,
          status,
        };
      });

      const expiredCount = rows.filter((r) => r.status === "Expired").length;
      const nearExpiryCount = rows.filter((r) => r.status === "Near Expiry").length;

      summaryCards = [
        { label: "Expired Products", value: expiredCount.toString(), desc: "Require immediate disposal" },
        { label: "Near Expiry (<=60 Days)", value: nearExpiryCount.toString(), desc: "Prioritize for promo sales" },
      ];

      chartData = [
        { name: "Expired", value: expiredCount },
        { name: "Near Expiry", value: nearExpiryCount },
        { name: "Good", value: rows.length - expiredCount - nearExpiryCount },
      ];
      break;
    }

    case "stock-adjustment": {
      title = "Stock Adjustment Report";
      description = "List of approved and applied stock adjustment requests.";
      headers = ["Adjustment ID", "SKU", "Quantity Change", "Reason / Category", "Type", "Status", "Date Applied"];

      const adjustments = await prisma.stockAdjustment.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      rows = adjustments.map((a) => ({
        id: a.id,
        sku: a.sku,
        change: a.qtyChange > 0 ? `+${a.qtyChange}` : a.qtyChange,
        reason: a.reasonCategory || "—",
        type: a.type,
        status: a.status,
        date: a.createdAt.toLocaleDateString("en-GB").replace(/\//g, "-"),
      }));

      const totalAdjusts = adjustments.length;
      const discrepancySum = adjustments.reduce((acc, a) => acc + a.qtyChange, 0);

      summaryCards = [
        { label: "Total Adjustments", value: totalAdjusts.toString(), desc: "Reconciliation adjustments applied" },
        { label: "Total Qty Discrepancy", value: discrepancySum > 0 ? `+${discrepancySum}` : discrepancySum.toString(), desc: "Sum of stock changes" },
      ];

      chartData = [
        { name: "Deductions (Damaged/Lost)", value: adjustments.filter((a) => a.qtyChange < 0).length },
        { name: "Additions (Audit surplus)", value: adjustments.filter((a) => a.qtyChange > 0).length },
      ];
      break;
    }

    case "stock-transfer": {
      title = "Stock Transfer Report";
      description = "Movements of stock between business locations.";
      headers = ["Date", "SKU", "Quantity", "From Location", "To Location", "Requested By"];

      const transfers = await prisma.stockTransfer.findMany({
        include: { fromLocation: true, toLocation: true, requester: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      rows = transfers.map((t) => ({
        date: t.createdAt.toLocaleDateString("en-GB").replace(/\//g, "-"),
        sku: t.sku,
        qty: t.qty,
        from: t.fromLocation.name,
        to: t.toLocation.name,
        by: t.requester.name,
      }));

      const totalQty = transfers.reduce((acc, t) => acc + t.qty, 0);
      const byLocationOut = new Map<string, number>();
      for (const t of transfers) {
        byLocationOut.set(t.fromLocation.name, (byLocationOut.get(t.fromLocation.name) ?? 0) + t.qty);
      }

      summaryCards = [
        { label: "Total Transfers", value: transfers.length.toString(), desc: "Movements recorded" },
        { label: "Total Units Moved", value: totalQty.toString(), desc: "Sum of transferred quantities" },
      ];

      chartData = [...byLocationOut.entries()].map(([name, value]) => ({ name, value }));
      break;
    }

    case "trending-products": {
      title = "Trending Products";
      description = "Product popularity ranked by volume sold.";
      headers = ["SKU", "Product Name", "Quantity Sold", "Revenue Generated"];

      const items = await prisma.transactionItem.findMany();
      const bySku = new Map<string, { qty: number; revenue: number }>();
      for (const item of items) {
        const revenue = Number(item.unitPrice) * item.qty - Number(item.discount);
        const existing = bySku.get(item.sku) ?? { qty: 0, revenue: 0 };
        existing.qty += item.qty;
        existing.revenue += revenue;
        bySku.set(item.sku, existing);
      }
      const skus = [...bySku.keys()];
      const inventoryItems = await prisma.inventoryItem.findMany({ where: { sku: { in: skus } } });
      const nameBySku = new Map(inventoryItems.map((i) => [i.sku, i.name]));

      const trends = [...bySku.entries()]
        .map(([sku, agg]) => ({
          sku,
          name: nameBySku.get(sku) ?? sku,
          qty: agg.qty,
          revenue: agg.revenue,
        }))
        .sort((a, b) => b.qty - a.qty);

      rows = trends.map((t) => ({
        sku: t.sku,
        name: t.name,
        qty: t.qty,
        revenue: currencyFmt(t.revenue),
      }));

      const totalUnits = trends.reduce((acc, t) => acc + t.qty, 0);

      summaryCards = [
        { label: "Top Seller Product", value: trends[0]?.name || "N/A", desc: `${trends[0]?.qty || 0} units sold` },
        { label: "Total Units Sold", value: totalUnits.toString(), desc: "POS volume cumulative" },
      ];

      chartData = trends.slice(0, 7).map((t) => ({
        name: t.name,
        value: t.qty,
      }));
      break;
    }

    case "items": {
      title = "Items Report";
      description = "Detailed line-item record of individual products sold.";
      headers = ["Product SKU", "Quantity Sold", "Selling Price", "Discount Given", "Subtotal"];

      const items = await prisma.transactionItem.findMany({
        orderBy: { id: "desc" },
        take: 100,
      });

      rows = items.map((i) => {
        const subtotal = Number(i.unitPrice) * i.qty - Number(i.discount);
        return {
          sku: i.sku,
          qty: i.qty,
          price: currencyFmt(Number(i.unitPrice)),
          discount: currencyFmt(Number(i.discount)),
          subtotal: currencyFmt(subtotal),
        };
      });

      const totalItemsRevenue = items.reduce((acc, i) => acc + (Number(i.unitPrice) * i.qty - Number(i.discount)), 0);

      summaryCards = [
        { label: "Line Items Processed", value: items.length.toString(), desc: "Top 100 recent rows" },
        { label: "Item Level Revenues", value: currencyFmt(totalItemsRevenue), desc: "Sum of displayed transactions" },
      ];

      chartData = items.slice(0, 10).map((i, index) => ({
        name: `Row ${index + 1} (${i.sku})`,
        value: Number(i.unitPrice) * i.qty - Number(i.discount),
      }));
      break;
    }

    case "product-purchase": {
      title = "Product Purchase Report";
      description = "Catalog tracking of product asset values and purchase estimates.";
      headers = ["SKU", "Product Name", "Current Stock Qty", "Estimated Purchase Cost", "Inventory Value"];

      const inventory = await prisma.inventoryItem.findMany();

      rows = inventory.map((i) => {
        const cogsEst = Number(i.purchasePrice) > 0 ? Number(i.purchasePrice) : Number(i.unitPrice) * 0.8;
        return {
          sku: i.sku,
          name: i.name,
          qty: i.qtyOnHand,
          cost: currencyFmt(cogsEst),
          value: currencyFmt(cogsEst * i.qtyOnHand),
        };
      });

      const totalVal = inventory.reduce((acc, i) => acc + (Number(i.purchasePrice) > 0 ? Number(i.purchasePrice) : Number(i.unitPrice) * 0.8) * i.qtyOnHand, 0);

      summaryCards = [
        { label: "Catalog Products", value: inventory.length.toString(), desc: "Under asset valuation" },
        { label: "Total Assets Value", value: currencyFmt(totalVal), desc: "Cumulative COGS for current stock" },
      ];

      chartData = inventory.slice(0, 8).map((i) => ({
        name: i.name,
        value: (Number(i.purchasePrice) > 0 ? Number(i.purchasePrice) : Number(i.unitPrice) * 0.8) * i.qtyOnHand,
      }));
      break;
    }

    case "product-sell": {
      title = "Product Sell Report";
      description = "Product specific gross retail value tracking.";
      headers = ["SKU", "Product Name", "Units Sold", "Retail Subtotal", "Net Sales Revenue"];

      const items = await prisma.transactionItem.findMany();
      const bySku = new Map<string, { qty: number; gross: number; net: number }>();
      for (const item of items) {
        const gross = Number(item.unitPrice) * item.qty;
        const net = gross - Number(item.discount);
        const existing = bySku.get(item.sku) ?? { qty: 0, gross: 0, net: 0 };
        existing.qty += item.qty;
        existing.gross += gross;
        existing.net += net;
        bySku.set(item.sku, existing);
      }
      const skus = [...bySku.keys()];
      const inventoryItems = await prisma.inventoryItem.findMany({ where: { sku: { in: skus } } });
      const nameBySku = new Map(inventoryItems.map((i) => [i.sku, i.name]));

      rows = [...bySku.entries()].map(([sku, agg]) => ({
        sku,
        name: nameBySku.get(sku) ?? sku,
        qty: agg.qty,
        gross: currencyFmt(agg.gross),
        net: currencyFmt(agg.net),
      }));

      const totalNet = [...bySku.values()].reduce((acc, val) => acc + val.net, 0);

      summaryCards = [
        { label: "Gross Sales Revenue", value: currencyFmt(totalNet), desc: "Items sold cumulative" },
      ];

      chartData = [...bySku.entries()].slice(0, 7).map(([sku, agg]) => ({
        name: nameBySku.get(sku) ?? sku,
        value: agg.net,
      }));
      break;
    }

    case "purchase-payment": {
      title = "Purchase Payment Report";
      description = "Ledger of payments sent to suppliers for inventory stock.";
      headers = ["Payment Date", "Supplier", "Reference No", "Payment Method", "Status", "Amount Paid"];

      const purchases = await prisma.purchase.findMany({
        orderBy: { createdAt: "desc" },
      });
      const suppliers = await prisma.supplier.findMany();
      const supplierMap = new Map(suppliers.map((s) => [s.id, s.name]));

      rows = purchases.map((p) => ({
        date: p.createdAt.toLocaleDateString("en-GB").replace(/\//g, "-"),
        supplier: supplierMap.get(p.supplierId) || "Unknown",
        ref: p.referenceNo,
        method: p.paymentMethod,
        status: p.status,
        amount: currencyFmt(Number(p.amountPaid)),
      }));

      const totalPaid = purchases.reduce((acc, p) => acc + Number(p.amountPaid), 0);

      summaryCards = [
        { label: "Total Paid Outflow", value: currencyFmt(totalPaid), desc: "Suppliers payment records" },
        { label: "Registered Suppliers", value: suppliers.length.toString(), desc: "Suppliers count" },
      ];

      chartData = suppliers.slice(0, 5).map((s) => {
        const amt = purchases.filter((p) => p.supplierId === s.id).reduce((acc, p) => acc + Number(p.amountPaid), 0);
        return { name: s.name, value: amt };
      });
      break;
    }

    case "sell-payment": {
      title = "Sell Payment Report";
      description = "List of customer payments grouped by POS payment tenders.";
      headers = ["Transaction ID", "Tender Method", "Amount Received"];

      const tenders = await prisma.paymentTender.findMany({
        orderBy: { id: "desc" },
        take: 100,
      });

      rows = tenders.map((t) => ({
        id: t.transactionId,
        method: t.method,
        amount: currencyFmt(Number(t.amount)),
      }));

      const totalReceived = tenders.reduce((acc, t) => acc + Number(t.amount), 0);

      summaryCards = [
        { label: "Total POS Tendered", value: currencyFmt(totalReceived), desc: "Sum of recent 100 tenders" },
      ];

      const byMethod = new Map<string, number>();
      for (const t of tenders) {
        byMethod.set(t.method, (byMethod.get(t.method) ?? 0) + Number(t.amount));
      }

      chartData = [...byMethod.entries()].map(([name, value]) => ({ name, value }));
      break;
    }

    case "expense": {
      title = "Expense Report";
      description = "Monthly operating expenditures.";
      headers = ["Expense Category", "Expense Details", "Status", "Amount"];

      const expenses = await prisma.expense.findMany({
        orderBy: { createdAt: "desc" },
      });

      rows = expenses.map((e) => ({
        category: e.category,
        details: e.details,
        status: e.status,
        amount: currencyFmt(Number(e.amount)),
      }));

      const totalExpense = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

      summaryCards = [
        { label: "Total Operating Expenses", value: currencyFmt(totalExpense), desc: "From expenses ledger" },
      ];

      const byCategory = new Map<string, number>();
      for (const e of expenses) {
        byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
      }

      chartData = [...byCategory.entries()].map(([name, value]) => ({ name, value }));
      break;
    }

    case "register": {
      title = "Register Report";
      description = "POS terminal activity breakdown.";
      headers = ["Register ID / Terminal", "Transactions Run", "Revenues Collected"];

      const transactions = await prisma.transaction.findMany({
        where: { status: "completed" },
      });

      const byRegister = new Map<string, { count: number; total: number }>();
      for (const t of transactions) {
        const existing = byRegister.get(t.registerId) ?? { count: 0, total: 0 };
        existing.count++;
        existing.total += Number(t.total);
        byRegister.set(t.registerId, existing);
      }

      rows = [...byRegister.entries()].map(([reg, agg]) => ({
        register: reg,
        count: agg.count,
        total: currencyFmt(agg.total),
      }));

      summaryCards = [
        { label: "Active Terminals", value: byRegister.size.toString(), desc: "Registers with activity logs" },
      ];

      chartData = [...byRegister.entries()].map(([reg, agg]) => ({
        name: reg,
        value: 0,
      }));
      break;
    }

    case "sales-representative": {
      title = "Sales Representative Report";
      description = "Performance metrics for cashiers and sales representatives.";
      headers = ["Rep Name", "Role", "Transactions Handled", "Total Revenue Brought"];

      const transactions = await prisma.transaction.findMany({
        where: { status: "completed" },
        include: { cashier: true },
      });

      const byRep = new Map<string, { name: string; role: string; count: number; total: number }>();
      for (const t of transactions) {
        const existing = byRep.get(t.cashierId) ?? { name: t.cashier.name, role: t.cashier.role, count: 0, total: 0 };
        existing.count++;
        existing.total += Number(t.total);
        byRep.set(t.cashierId, existing);
      }

      rows = [...byRep.values()].map((r) => ({
        name: r.name,
        role: r.role,
        count: r.count,
        total: currencyFmt(r.total),
      }));

      const topRep = [...byRep.values()].sort((a, b) => b.total - a.total)[0];

      summaryCards = [
        { label: "Top Sales Rep", value: topRep ? topRep.name : "N/A", desc: topRep ? currencyFmt(topRep.total) : "No transactions" },
      ];

      chartData = [...byRep.values()].map((r) => ({
        name: r.name,
        value: r.total,
      }));
      break;
    }
  }

  const reportData: ReportData = {
    title,
    description,
    type,
    headers,
    rows,
    summaryCards,
    chartData,
    plMetrics,
    plTabsData,
  };

  return <ReportClient reportData={reportData} />;
}
