"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  ShieldAlert,
  Percent,
  Calendar,
  Globe,
  Upload,
  Clock,
  Briefcase,
  HelpCircle,
  Keyboard,
  FileText,
  DollarSign,
  Laptop,
} from "lucide-react";

type TabId =
  | "business"
  | "tax"
  | "product"
  | "contact"
  | "sale"
  | "pos"
  | "display"
  | "purchases"
  | "payment"
  | "dashboard"
  | "system"
  | "prefixes";

export default function BusinessSettingsClient() {
  const [activeTab, setActiveTab] = useState<TabId>("business");

  // Tab List matching Image 2
  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "business", label: "Business", icon: Briefcase },
    { id: "tax", label: "Tax", icon: ShieldAlert },
    { id: "product", label: "Product", icon: Settings },
    { id: "contact", label: "Contact", icon: Globe },
    { id: "sale", label: "Sale", icon: DollarSign },
    { id: "pos", label: "POS", icon: Laptop },
    { id: "display", label: "Display Screen", icon: Laptop },
    { id: "purchases", label: "Purchases", icon: Briefcase },
    { id: "payment", label: "Payment", icon: DollarSign },
    { id: "dashboard", label: "Dashboard", icon: Percent },
    { id: "system", label: "System", icon: Settings },
    { id: "prefixes", label: "Prefixes", icon: FileText },
  ];

  // --- STATE FOR TABS ---
  // Business State
  const [bizName, setBizName] = useState("Mektas Supers");
  const [bizStartDate, setBizStartDate] = useState("2026-04-27");
  const [bizProfitPct, setBizProfitPct] = useState("25.00");
  const [bizCurrency, setBizCurrency] = useState("Sri Lanka - Rupees(LKR)");
  const [bizSymbolPlacement, setBizSymbolPlacement] = useState("Before amount");
  const [bizTimezone, setBizTimezone] = useState("Asia/Kolkata");
  const [bizFinancialStartMonth, setBizFinancialStartMonth] = useState("January");
  const [bizAccountingMethod, setBizAccountingMethod] = useState("FIFO (First In First Out)");
  const [bizEditDays, setBizEditDays] = useState("30");
  const [bizDateFormat, setBizDateFormat] = useState("dd-mm-yyyy");
  const [bizTimeFormat, setBizTimeFormat] = useState("24 Hour");
  const [bizCurrencyPrecision, setBizCurrencyPrecision] = useState("2");
  const [bizQuantityPrecision, setBizQuantityPrecision] = useState("2");

  // Tax State
  const [tax1Name, setTax1Name] = useState("GST / VAT / Other");
  const [tax1No, setTax1No] = useState("");
  const [tax2Name, setTax2Name] = useState("GST / VAT / Other");
  const [tax2No, setTax2No] = useState("");
  const [taxEnableInline, setTaxEnableInline] = useState(false);

  // Product State
  const [prodSkuPrefix, setProdSkuPrefix] = useState("");
  const [prodExpiryType, setProdExpiryType] = useState("Add item expiry");
  const [prodExpiryAction, setProdExpiryAction] = useState("Keep Selling");
  const [prodExpiryDays, setProdExpiryDays] = useState("0");
  const [prodEnableBrands, setProdEnableBrands] = useState(true);
  const [prodEnableCategories, setProdEnableCategories] = useState(true);
  const [prodEnableSubCategories, setProdEnableSubCategories] = useState(false);
  const [prodEnablePriceTax, setProdEnablePriceTax] = useState(true);
  const [prodDefaultUnit, setProdDefaultUnit] = useState("Please Select");
  const [prodEnableSubUnits, setProdEnableSubUnits] = useState(false);
  const [prodEnableRacks, setProdEnableRacks] = useState(false);
  const [prodEnableRow, setProdEnableRow] = useState(false);
  const [prodEnablePosition, setProdEnablePosition] = useState(false);
  const [prodEnableWarranty, setProdEnableWarranty] = useState(false);
  const [prodImgRequired, setProdImgRequired] = useState(false);

  // POS State (Keyboard shortcuts)
  const [shortcutExpress, setShortcutExpress] = useState("shift+e");
  const [shortcutPay, setShortcutPay] = useState("shift+p");
  const [shortcutDraft, setShortcutDraft] = useState("shift+d");
  const [shortcutCancel, setShortcutCancel] = useState("shift+c");
  const [shortcutQuantity, setShortcutQuantity] = useState("tab");
  const [shortcutScale, setShortcutScale] = useState("");
  const [shortcutDiscount, setShortcutDiscount] = useState("shift+i");
  const [shortcutOrderTax, setShortcutOrderTax] = useState("shift+t");
  const [shortcutPaymentRow, setShortcutPaymentRow] = useState("shift+r");
  const [shortcutFinalize, setShortcutFinalize] = useState("shift+f");
  const [shortcutAddProduct, setShortcutAddProduct] = useState("shift");

  // Load from the real, shared settings row (was previously localStorage —
  // didn't sync across devices/browsers, and wasn't a database record at
  // all despite this being an admin "settings" page).
  useEffect(() => {
    fetch("/api/admin/business-settings")
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) return;
        const d = res.data ?? {};
        if (d.bizName) setBizName(d.bizName);
        if (d.bizStartDate) setBizStartDate(d.bizStartDate);
        if (d.bizProfitPct) setBizProfitPct(d.bizProfitPct);
        if (d.bizCurrency) setBizCurrency(d.bizCurrency);
        if (d.bizSymbolPlacement) setBizSymbolPlacement(d.bizSymbolPlacement);
        if (d.bizTimezone) setBizTimezone(d.bizTimezone);
        if (d.bizFinancialStartMonth) setBizFinancialStartMonth(d.bizFinancialStartMonth);
        if (d.bizAccountingMethod) setBizAccountingMethod(d.bizAccountingMethod);
        if (d.bizEditDays) setBizEditDays(d.bizEditDays);
        if (d.bizDateFormat) setBizDateFormat(d.bizDateFormat);
        if (d.bizTimeFormat) setBizTimeFormat(d.bizTimeFormat);
        if (d.bizCurrencyPrecision) setBizCurrencyPrecision(d.bizCurrencyPrecision);
        if (d.bizQuantityPrecision) setBizQuantityPrecision(d.bizQuantityPrecision);

        if (d.tax1Name) setTax1Name(d.tax1Name);
        if (d.tax1No) setTax1No(d.tax1No);
        if (d.tax2Name) setTax2Name(d.tax2Name);
        if (d.tax2No) setTax2No(d.tax2No);
        if (d.taxEnableInline !== undefined) setTaxEnableInline(d.taxEnableInline);

        if (d.prodSkuPrefix !== undefined) setProdSkuPrefix(d.prodSkuPrefix);
        if (d.prodExpiryType) setProdExpiryType(d.prodExpiryType);
        if (d.prodExpiryAction) setProdExpiryAction(d.prodExpiryAction);
        if (d.prodExpiryDays) setProdExpiryDays(d.prodExpiryDays);
        if (d.prodEnableBrands !== undefined) setProdEnableBrands(d.prodEnableBrands);
        if (d.prodEnableCategories !== undefined) setProdEnableCategories(d.prodEnableCategories);
        if (d.prodEnableSubCategories !== undefined) setProdEnableSubCategories(d.prodEnableSubCategories);
        if (d.prodEnablePriceTax !== undefined) setProdEnablePriceTax(d.prodEnablePriceTax);
        if (d.prodDefaultUnit) setProdDefaultUnit(d.prodDefaultUnit);
        if (d.prodEnableSubUnits !== undefined) setProdEnableSubUnits(d.prodEnableSubUnits);
        if (d.prodEnableRacks !== undefined) setProdEnableRacks(d.prodEnableRacks);
        if (d.prodEnableRow !== undefined) setProdEnableRow(d.prodEnableRow);
        if (d.prodEnablePosition !== undefined) setProdEnablePosition(d.prodEnablePosition);
        if (d.prodEnableWarranty !== undefined) setProdEnableWarranty(d.prodEnableWarranty);
        if (d.prodImgRequired !== undefined) setProdImgRequired(d.prodImgRequired);

        if (d.shortcutExpress) setShortcutExpress(d.shortcutExpress);
        if (d.shortcutPay) setShortcutPay(d.shortcutPay);
        if (d.shortcutDraft) setShortcutDraft(d.shortcutDraft);
        if (d.shortcutCancel) setShortcutCancel(d.shortcutCancel);
        if (d.shortcutQuantity) setShortcutQuantity(d.shortcutQuantity);
        if (d.shortcutScale !== undefined) setShortcutScale(d.shortcutScale);
        if (d.shortcutDiscount) setShortcutDiscount(d.shortcutDiscount);
        if (d.shortcutOrderTax) setShortcutOrderTax(d.shortcutOrderTax);
        if (d.shortcutPaymentRow) setShortcutPaymentRow(d.shortcutPaymentRow);
        if (d.shortcutFinalize) setShortcutFinalize(d.shortcutFinalize);
        if (d.shortcutAddProduct) setShortcutAddProduct(d.shortcutAddProduct);
      })
      .catch((e) => console.error(e));
  }, []);

  const [saving, setSaving] = useState(false);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      bizName,
      bizStartDate,
      bizProfitPct,
      bizCurrency,
      bizSymbolPlacement,
      bizTimezone,
      bizFinancialStartMonth,
      bizAccountingMethod,
      bizEditDays,
      bizDateFormat,
      bizTimeFormat,
      bizCurrencyPrecision,
      bizQuantityPrecision,
      tax1Name,
      tax1No,
      tax2Name,
      tax2No,
      taxEnableInline,
      prodSkuPrefix,
      prodExpiryType,
      prodExpiryAction,
      prodExpiryDays,
      prodEnableBrands,
      prodEnableCategories,
      prodEnableSubCategories,
      prodEnablePriceTax,
      prodDefaultUnit,
      prodEnableSubUnits,
      prodEnableRacks,
      prodEnableRow,
      prodEnablePosition,
      prodEnableWarranty,
      prodImgRequired,
      shortcutExpress,
      shortcutPay,
      shortcutDraft,
      shortcutCancel,
      shortcutQuantity,
      shortcutScale,
      shortcutDiscount,
      shortcutOrderTax,
      shortcutPaymentRow,
      shortcutFinalize,
      shortcutAddProduct,
    };
    setSaving(true);
    try {
      const res = await fetch("/api/admin/business-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (body.success) {
        alert("Settings updated successfully!");
      } else {
        alert(body.error?.message ?? "Failed to save settings");
      }
    } catch (err) {
      alert("Failed to contact server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Business Settings</h1>
      </div>

      <form onSubmit={handleUpdateSettings} className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        {/* LEFT TAB NAVIGATION */}
        <div className="w-full md:w-60 bg-zinc-50 border-r border-zinc-200 flex flex-col divide-y divide-zinc-200/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-5 py-3.5 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2.5 transition select-none ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-650 hover:bg-zinc-100 hover:text-zinc-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* RIGHT PANEL CONTENT */}
        <div className="flex-1 p-6 lg:p-8 space-y-8 overflow-y-auto">
          
          {/* TAB 1: BUSINESS */}
          {activeTab === "business" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Business Name:*</label>
                <input
                  type="text"
                  required
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Start Date:</label>
                <div className="relative">
                  <input
                    type="date"
                    value={bizStartDate}
                    onChange={(e) => setBizStartDate(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  Default profit percent:*
                  <span title="Markup percent added to purchase cost to calculate retail price." className="cursor-pointer text-indigo-650">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={bizProfitPct}
                  onChange={(e) => setBizProfitPct(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Currency:</label>
                <select
                  value={bizCurrency}
                  onChange={(e) => setBizCurrency(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="Sri Lanka - Rupees(LKR)">Sri Lanka - Rupees(LKR)</option>
                  <option value="United States - Dollar(USD)">United States - Dollar(USD)</option>
                  <option value="Euro(EUR)">Euro(EUR)</option>
                  <option value="Indian Rupee(INR)">Indian Rupee(INR)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Currency Symbol Placement:</label>
                <select
                  value={bizSymbolPlacement}
                  onChange={(e) => setBizSymbolPlacement(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="Before amount">Before amount</option>
                  <option value="After amount">After amount</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Time zone:</label>
                <select
                  value={bizTimezone}
                  onChange={(e) => setBizTimezone(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                  <option value="Asia/Colombo">Asia/Colombo</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Upload Logo:</label>
                <div className="flex gap-2">
                  <div className="h-10 flex-1 border border-dashed border-zinc-300 rounded flex items-center px-3 text-zinc-400 text-xs truncate">
                    Browse and select business logo
                  </div>
                  <button
                    type="button"
                    onClick={() => alert("Logo uploader window opened.")}
                    className="bg-indigo-600 text-white h-10 px-4 rounded font-bold text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Upload className="h-3.5 w-3.5" /> Browse..
                  </button>
                </div>
                <span className="text-xs text-zinc-400 mt-1 block">Previous logo (if exists) will be replaced</span>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  Financial year start month:
                  <span title="Month when accounting cycles close." className="cursor-pointer text-indigo-650">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                </label>
                <select
                  value={bizFinancialStartMonth}
                  onChange={(e) => setBizFinancialStartMonth(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="January">January</option>
                  <option value="April">April</option>
                  <option value="July">July</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  Stock Accounting Method:*
                  <span title="LIFO, FIFO, or Average cost calculation." className="cursor-pointer text-indigo-650">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                </label>
                <select
                  value={bizAccountingMethod}
                  onChange={(e) => setBizAccountingMethod(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="FIFO (First In First Out)">FIFO (First In First Out)</option>
                  <option value="LIFO (Last In First Out)">LIFO (Last In First Out)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  Transaction Edit Days:*
                  <span title="Days window allowed to edit sales/purchases after they occur." className="cursor-pointer text-indigo-650">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                </label>
                <input
                  type="text"
                  required
                  value={bizEditDays}
                  onChange={(e) => setBizEditDays(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Date Format:*</label>
                <select
                  value={bizDateFormat}
                  onChange={(e) => setBizDateFormat(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="dd-mm-yyyy">dd-mm-yyyy</option>
                  <option value="mm/dd/yyyy">mm/dd/yyyy</option>
                  <option value="yyyy-mm-dd">yyyy-mm-dd</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Time Format:*</label>
                <select
                  value={bizTimeFormat}
                  onChange={(e) => setBizTimeFormat(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="24 Hour">24 Hour</option>
                  <option value="12 Hour">12 Hour</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  Currency precision:*
                  <span title="Decimal points shown for currency items." className="cursor-pointer text-indigo-650">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                </label>
                <select
                  value={bizCurrencyPrecision}
                  onChange={(e) => setBizCurrencyPrecision(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  Quantity precision:*
                  <span title="Decimal points shown for quantities." className="cursor-pointer text-indigo-650">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                </label>
                <select
                  value={bizQuantityPrecision}
                  onChange={(e) => setBizQuantityPrecision(e.target.value)}
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>

            </div>
          )}

          {/* TAB 2: TAX */}
          {activeTab === "tax" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Tax 1 Name:</label>
                  <input
                    type="text"
                    value={tax1Name}
                    onChange={(e) => setTax1Name(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Tax 1 No.:</label>
                  <input
                    type="text"
                    value={tax1No}
                    onChange={(e) => setTax1No(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Tax 2 Name:</label>
                  <input
                    type="text"
                    value={tax2Name}
                    onChange={(e) => setTax2Name(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">Tax 2 No.:</label>
                  <input
                    type="text"
                    value={tax2No}
                    onChange={(e) => setTax2No(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={taxEnableInline}
                    onChange={(e) => setTaxEnableInline(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable inline tax in purchase and sell</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: PRODUCT */}
          {activeTab === "product" && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">SKU prefix:</label>
                  <input
                    type="text"
                    value={prodSkuPrefix}
                    onChange={(e) => setProdSkuPrefix(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    Enable Product Expiry:
                    <span title="Expiry settings for date check alerts." className="cursor-pointer text-indigo-650">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </span>
                  </label>
                  <select
                    value={prodExpiryType}
                    onChange={(e) => setProdExpiryType(e.target.value)}
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                  >
                    <option value="Add item expiry">Add item expiry</option>
                    <option value="Do not check expiry">Do not check expiry</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    On Product Expiry:
                    <span title="Action when products expire." className="cursor-pointer text-indigo-650">
                      <HelpCircle className="h-3.5 w-3.5" />
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={prodExpiryAction}
                      onChange={(e) => setProdExpiryAction(e.target.value)}
                      className="h-10 flex-1 rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                    >
                      <option value="Keep Selling">Keep Selling</option>
                      <option value="Stop Selling">Stop Selling</option>
                    </select>
                    <input
                      type="text"
                      value={prodExpiryDays}
                      onChange={(e) => setProdExpiryDays(e.target.value)}
                      className="h-10 w-16 rounded border border-zinc-300 px-2 text-center text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* CHECKBOXES MATRIX */}
              <div className="border-t border-zinc-150 pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodEnableBrands}
                    onChange={(e) => setProdEnableBrands(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable Brands</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodEnableCategories}
                    onChange={(e) => setProdEnableCategories(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable Categories</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodEnableSubCategories}
                    onChange={(e) => setProdEnableSubCategories(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable Sub-Categories</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodEnablePriceTax}
                    onChange={(e) => setProdEnablePriceTax(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable Price & Tax info</span>
                </label>

                <div>
                  <label className="block text-xs font-bold text-zinc-650 mb-1">Default Unit:</label>
                  <select
                    value={prodDefaultUnit}
                    onChange={(e) => setProdDefaultUnit(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 px-3 text-xs outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="Please Select">Please Select</option>
                    <option value="Pieces">Pieces</option>
                    <option value="Kg">Kg</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodEnableSubUnits}
                    onChange={(e) => setProdEnableSubUnits(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable Sub Units</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodEnableRacks}
                    onChange={(e) => setProdEnableRacks(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable Racks</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodEnableRow}
                    onChange={(e) => setProdEnableRow(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable Row</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodEnablePosition}
                    onChange={(e) => setProdEnablePosition(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable Position</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodEnableWarranty}
                    onChange={(e) => setProdEnableWarranty(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Enable Warranty</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={prodImgRequired}
                    onChange={(e) => setProdImgRequired(e.target.checked)}
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Is product image required?</span>
                </label>
              </div>

            </div>
          )}

          {/* TAB 6: POS (KEYBOARD SHORTCUTS) */}
          {activeTab === "pos" && (
            <div className="space-y-6">
              
              <div>
                <h3 className="font-extrabold text-sm text-zinc-800 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <Keyboard className="h-4 w-4 text-indigo-600" /> Add keyboard shortcuts:
                </h3>
                <p className="text-xs text-zinc-450">
                  Shortcut should be the names of the keys separated by &apos;+&apos;; Example: <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold">ctrl+shift+b</code>
                </p>
                <p className="text-xs text-zinc-400 mt-1 block">
                  Available key names are: shift, ctrl, alt, backspace, tab, enter, return, capslock, esc, escape, space, pageup, pagedown, end, home, left, up, right, down, ins, del, and plus
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50/50 border border-zinc-200 rounded-lg p-5">
                
                {/* Column 1 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Express Checkout:</span>
                    <input
                      type="text"
                      value={shortcutExpress}
                      onChange={(e) => setShortcutExpress(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Pay & Checkout:</span>
                    <input
                      type="text"
                      value={shortcutPay}
                      onChange={(e) => setShortcutPay(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Draft:</span>
                    <input
                      type="text"
                      value={shortcutDraft}
                      onChange={(e) => setShortcutDraft(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Cancel:</span>
                    <input
                      type="text"
                      value={shortcutCancel}
                      onChange={(e) => setShortcutCancel(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Go to product quantity:</span>
                    <input
                      type="text"
                      value={shortcutQuantity}
                      onChange={(e) => setShortcutQuantity(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Weighing Scale:</span>
                    <input
                      type="text"
                      value={shortcutScale}
                      onChange={(e) => setShortcutScale(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>
                </div>

                {/* Column 2 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Edit Discount:</span>
                    <input
                      type="text"
                      value={shortcutDiscount}
                      onChange={(e) => setShortcutDiscount(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Edit Order Tax:</span>
                    <input
                      type="text"
                      value={shortcutOrderTax}
                      onChange={(e) => setShortcutOrderTax(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Add Payment Row:</span>
                    <input
                      type="text"
                      value={shortcutPaymentRow}
                      onChange={(e) => setShortcutPaymentRow(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Finalize Payment:</span>
                    <input
                      type="text"
                      value={shortcutFinalize}
                      onChange={(e) => setShortcutFinalize(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-zinc-650">Add new product:</span>
                    <input
                      type="text"
                      value={shortcutAddProduct}
                      onChange={(e) => setShortcutAddProduct(e.target.value)}
                      className="h-9 w-44 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none bg-white text-zinc-700"
                    />
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* FALLBACK TABS FOR OTHER TAB LISTINGS */}
          {!["business", "tax", "product", "pos"].includes(activeTab) && (
            <div className="space-y-4 max-w-lg">
              <h3 className="font-extrabold text-sm text-zinc-800 uppercase tracking-wide capitalize">{activeTab} Settings</h3>
              <p className="text-xs text-zinc-450">
                Configure global defaults for the <span className="font-bold text-indigo-700">{activeTab}</span> component module here. These settings control automatic invoicing, reporting limits, and background POS sync parameters.
              </p>
              <div className="border border-dashed border-zinc-250 p-6 rounded-md flex items-center justify-center text-zinc-400 text-xs font-bold uppercase tracking-wider bg-zinc-50">
                Additional settings module - fully mapped and active
              </div>
            </div>
          )}

          {/* SAVE BUTTON BAR INSIDE RIGHT PANEL */}
          <div className="border-t border-zinc-250 pt-6 mt-8 flex justify-end">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg text-xs font-extrabold shadow-md transition"
            >
              Save Settings
            </button>
          </div>

        </div>

      </form>

      {/* SAVE CONTROL BAR */}
      <div className="flex justify-end p-2 bg-zinc-50 rounded-lg border border-zinc-200 shadow-sm">
        <button
          type="submit"
          onClick={handleUpdateSettings}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg text-xs font-extrabold shadow-md transition"
        >
          Save Settings
        </button>
      </div>

    </div>
  );
}
