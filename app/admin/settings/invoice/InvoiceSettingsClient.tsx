"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Edit, Trash2, Search, Info, HelpCircle, ArrowLeft } from "lucide-react";
import { Modal } from "@/components/ui/modal";

// Type definitions for Invoice Scheme
interface InvoiceScheme {
  id: string;
  name: string;
  prefix: string;
  numberingType: string; // "Sequential" or "Year Based" etc.
  startNumber: string;
  invoiceCount: number;
  digits: string;
  isDefault: boolean;
}

// Type definitions for Invoice Layout
interface InvoiceLayout {
  id: string;
  name: string;
  design: string;
  showLetterHead: boolean;
  
  // Headings
  invoiceHeading: string;
  headingSuffixNotPaid: string;
  headingSuffixPaid: string;
  proformaInvoiceHeading: string;
  quotationHeading: string;
  salesOrderHeading: string;
  invoiceNoLabel: string;
  quotationNoLabel: string;
  dateLabel: string;
  dueDateLabel: string;
  showDueDate: boolean;
  dateTimeFormat: string;
  
  // Labels
  salesPersonLabel: string;
  commissionAgentLabel: string;
  showBusinessName: boolean;
  showLocationName: boolean;
  showSalesPerson: boolean;
  showCommissionAgent: boolean;
  
  // Customer details
  showCustomerInfo: boolean;
  customerLabel: string;
  showClientId: boolean;
  clientIdLabel: string;
  clientTaxNumberLabel: string;
  showRewardPoint: boolean;
  customField1: boolean;
  customField2: boolean;
  customField3: boolean;
  customField4: boolean;
  
  // Product columns labels
  productLabel: string;
  quantityLabel: string;
  unitPriceLabel: string;
  subtotalLabel: string;
  categoryOrHsnLabel: string;
  totalQuantityLabel: string;
  itemDiscountLabel: string;
  discountedUnitPriceLabel: string;
  
  // Product details
  showBrand: boolean;
  showSku: boolean;
  showCategoryOrHsn: boolean;
  showSaleDesc: boolean;
  showProductDesc: boolean;
  prodCustomField1: boolean;
  prodCustomField2: boolean;
  prodCustomField3: boolean;
  
  // QR code & receipt fields
  showQrCode: boolean;
  showLabels: boolean;
  zatcaQrCode: boolean;
  
  // Fields to show
  showBizName: boolean;
  showBizAddress: boolean;
  showBizTax1: boolean;
  showBizTax2: boolean;
  showInvoiceNo: boolean;
  showInvoiceDatetime: boolean;
  showSubtotal: boolean;
  showTotalWithTax: boolean;
  showTotalTax: boolean;
  showCustName: boolean;
  showInvoiceUrl: boolean;
  
  // Credit Note
  creditNoteHeading: string;
  creditNoteRefNo: string;
  creditNoteTotal: string;
  
  isDefault: boolean;
}

const INITIAL_SCHEMES: InvoiceScheme[] = [
  {
    id: "scheme-default",
    name: "Default",
    prefix: "",
    numberingType: "Sequential",
    startNumber: "1",
    invoiceCount: 9896,
    digits: "4",
    isDefault: true,
  },
];

const INITIAL_LAYOUTS: InvoiceLayout[] = [
  {
    id: "layout-default",
    name: "Default",
    design: "Slim (Recommended for thermal line receipt printer, 80mm paper size)",
    showLetterHead: true,
    invoiceHeading: "Invoice",
    headingSuffixNotPaid: "",
    headingSuffixPaid: "",
    proformaInvoiceHeading: "",
    quotationHeading: "",
    salesOrderHeading: "",
    invoiceNoLabel: "Invoice No.",
    quotationNoLabel: "",
    dateLabel: "Date",
    dueDateLabel: "",
    showDueDate: false,
    dateTimeFormat: "",
    salesPersonLabel: "",
    commissionAgentLabel: "",
    showBusinessName: false,
    showLocationName: true,
    showSalesPerson: false,
    showCommissionAgent: false,
    showCustomerInfo: true,
    customerLabel: "Customer",
    showClientId: false,
    clientIdLabel: "",
    clientTaxNumberLabel: "",
    showRewardPoint: false,
    customField1: false,
    customField2: false,
    customField3: false,
    customField4: false,
    productLabel: "Item",
    quantityLabel: "Qty",
    unitPriceLabel: "Unit Price",
    subtotalLabel: "Subtotal",
    categoryOrHsnLabel: "",
    totalQuantityLabel: "",
    itemDiscountLabel: "Dis",
    discountedUnitPriceLabel: "",
    showBrand: false,
    showSku: false,
    showCategoryOrHsn: false,
    showSaleDesc: false,
    showProductDesc: false,
    prodCustomField1: false,
    prodCustomField2: false,
    prodCustomField3: false,
    showQrCode: false,
    showLabels: false,
    zatcaQrCode: false,
    showBizName: false,
    showBizAddress: false,
    showBizTax1: false,
    showBizTax2: false,
    showInvoiceNo: false,
    showInvoiceDatetime: false,
    showSubtotal: false,
    showTotalWithTax: false,
    showTotalTax: false,
    showCustName: false,
    showInvoiceUrl: false,
    creditNoteHeading: "",
    creditNoteRefNo: "",
    creditNoteTotal: "",
    isDefault: true,
  },
];

export default function InvoiceSettingsClient() {
  const [activeTab, setActiveTab] = useState<"schemes" | "layouts">("schemes");
  const [schemes, setSchemes] = useState<InvoiceScheme[]>([]);
  const [layouts, setLayouts] = useState<InvoiceLayout[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals / Editors state
  const [schemeModalOpen, setSchemeModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<InvoiceScheme | null>(null);
  
  // Layout form editor state
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [editingLayout, setEditingLayout] = useState<Partial<InvoiceLayout> | null>(null);

  // Scheme Form Inputs
  const [schemeName, setSchemeName] = useState("");
  const [schemePrefix, setSchemePrefix] = useState("");
  const [schemeNumType, setSchemeNumType] = useState("Sequential");
  const [schemeStartFrom, setSchemeStartFrom] = useState("1");
  const [schemeDigits, setSchemeDigits] = useState("4");

  // Load from the real, shared settings row (was previously two separate
  // localStorage arrays — didn't sync across devices/browsers).
  useEffect(() => {
    fetch("/api/admin/invoice-settings")
      .then((r) => r.json())
      .then((res) => {
        if (!res.success) return;
        const d = res.data ?? {};
        const initialSchemes = Array.isArray(d.schemes) && d.schemes.length > 0 ? d.schemes : INITIAL_SCHEMES;
        const initialLayouts = Array.isArray(d.layouts) && d.layouts.length > 0 ? d.layouts : INITIAL_LAYOUTS;
        setSchemes(initialSchemes);
        setLayouts(initialLayouts);
        if (!Array.isArray(d.schemes) || !Array.isArray(d.layouts)) {
          // First load with nothing saved yet — persist the defaults.
          persistSettings(initialSchemes, initialLayouts);
        }
      })
      .catch((e) => console.error(e));
  }, []);

  async function persistSettings(nextSchemes: InvoiceScheme[], nextLayouts: InvoiceLayout[]) {
    try {
      await fetch("/api/admin/invoice-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemes: nextSchemes, layouts: nextLayouts }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  const saveSchemesToStorage = (updated: InvoiceScheme[]) => {
    setSchemes(updated);
    persistSettings(updated, layouts);
  };

  const saveLayoutsToStorage = (updated: InvoiceLayout[]) => {
    setLayouts(updated);
    persistSettings(schemes, updated);
  };

  // --- SCHEMES ACTIONS ---
  const handleOpenAddScheme = () => {
    setEditingScheme(null);
    setSchemeName("");
    setSchemePrefix("");
    setSchemeNumType("Sequential");
    setSchemeStartFrom("1");
    setSchemeDigits("4");
    setSchemeModalOpen(true);
  };

  const handleOpenEditScheme = (scheme: InvoiceScheme) => {
    setEditingScheme(scheme);
    setSchemeName(scheme.name);
    setSchemePrefix(scheme.prefix);
    setSchemeNumType(scheme.numberingType);
    setSchemeStartFrom(scheme.startNumber);
    setSchemeDigits(scheme.digits);
    setSchemeModalOpen(true);
  };

  const handleSaveScheme = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingScheme) {
      // Edit existing
      const updated = schemes.map((s) =>
        s.id === editingScheme.id
          ? {
              ...s,
              name: schemeName,
              prefix: schemePrefix,
              numberingType: schemeNumType,
              startNumber: schemeStartFrom,
              digits: schemeDigits,
            }
          : s
      );
      saveSchemesToStorage(updated);
    } else {
      // Create new
      const newScheme: InvoiceScheme = {
        id: `scheme-${Date.now()}`,
        name: schemeName,
        prefix: schemePrefix,
        numberingType: schemeNumType,
        startNumber: schemeStartFrom,
        invoiceCount: 0,
        digits: schemeDigits,
        isDefault: schemes.length === 0,
      };
      saveSchemesToStorage([...schemes, newScheme]);
    }
    setSchemeModalOpen(false);
  };

  const handleDeleteScheme = (id: string) => {
    const target = schemes.find((s) => s.id === id);
    if (target?.isDefault) {
      alert("Cannot delete the default scheme.");
      return;
    }
    if (confirm("Are you sure you want to delete this scheme?")) {
      const updated = schemes.filter((s) => s.id !== id);
      saveSchemesToStorage(updated);
    }
  };

  const handleSetDefaultScheme = (id: string) => {
    const updated = schemes.map((s) => ({
      ...s,
      isDefault: s.id === id,
    }));
    saveSchemesToStorage(updated);
  };

  // --- LAYOUT ACTIONS ---
  const handleOpenAddLayout = () => {
    setEditingLayout({
      name: "",
      design: "Slim (Recommended for thermal line receipt printer, 80mm paper size)",
      showLetterHead: true,
      invoiceHeading: "Invoice",
      headingSuffixNotPaid: "",
      headingSuffixPaid: "",
      proformaInvoiceHeading: "",
      quotationHeading: "",
      salesOrderHeading: "",
      invoiceNoLabel: "Invoice No.",
      quotationNoLabel: "",
      dateLabel: "Date",
      dueDateLabel: "",
      showDueDate: false,
      dateTimeFormat: "",
      salesPersonLabel: "",
      commissionAgentLabel: "",
      showBusinessName: false,
      showLocationName: true,
      showSalesPerson: false,
      showCommissionAgent: false,
      showCustomerInfo: true,
      customerLabel: "Customer",
      showClientId: false,
      clientIdLabel: "",
      clientTaxNumberLabel: "",
      showRewardPoint: false,
      customField1: false,
      customField2: false,
      customField3: false,
      customField4: false,
      productLabel: "Item",
      quantityLabel: "Qty",
      unitPriceLabel: "Unit Price",
      subtotalLabel: "Subtotal",
      categoryOrHsnLabel: "",
      totalQuantityLabel: "",
      itemDiscountLabel: "Dis",
      discountedUnitPriceLabel: "",
      showBrand: false,
      showSku: false,
      showCategoryOrHsn: false,
      showSaleDesc: false,
      showProductDesc: false,
      prodCustomField1: false,
      prodCustomField2: false,
      prodCustomField3: false,
      showQrCode: false,
      showLabels: false,
      zatcaQrCode: false,
      showBizName: false,
      showBizAddress: false,
      showBizTax1: false,
      showBizTax2: false,
      showInvoiceNo: false,
      showInvoiceDatetime: false,
      showSubtotal: false,
      showTotalWithTax: false,
      showTotalTax: false,
      showCustName: false,
      showInvoiceUrl: false,
      creditNoteHeading: "",
      creditNoteRefNo: "",
      creditNoteTotal: "",
    });
    setLayoutEditorOpen(true);
  };

  const handleOpenEditLayout = (layout: InvoiceLayout) => {
    setEditingLayout(layout);
    setLayoutEditorOpen(true);
  };

  const handleSaveLayout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLayout || !editingLayout.name) {
      alert("Layout name is required.");
      return;
    }

    if (editingLayout.id) {
      // Edit existing
      const updated = layouts.map((l) =>
        l.id === editingLayout.id ? (editingLayout as InvoiceLayout) : l
      );
      saveLayoutsToStorage(updated);
    } else {
      // Create new
      const newLayout: InvoiceLayout = {
        ...(editingLayout as Omit<InvoiceLayout, "id" | "isDefault">),
        id: `layout-${Date.now()}`,
        isDefault: layouts.length === 0,
      };
      saveLayoutsToStorage([...layouts, newLayout]);
    }
    setLayoutEditorOpen(false);
    setEditingLayout(null);
  };

  const handleDeleteLayout = (id: string) => {
    const target = layouts.find((l) => l.id === id);
    if (target?.isDefault) {
      alert("Cannot delete the default layout.");
      return;
    }
    if (confirm("Are you sure you want to delete this layout?")) {
      const updated = layouts.filter((l) => l.id !== id);
      saveLayoutsToStorage(updated);
    }
  };

  const handleSetDefaultLayout = (id: string) => {
    const updated = layouts.map((l) => ({
      ...l,
      isDefault: l.id === id,
    }));
    saveLayoutsToStorage(updated);
  };

  // Memoized lists based on search query
  const filteredSchemes = useMemo(() => {
    return schemes.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.prefix.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [schemes, searchQuery]);

  const filteredLayouts = useMemo(() => {
    return layouts.filter((l) =>
      l.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [layouts, searchQuery]);

  if (layoutEditorOpen && editingLayout) {
    return (
      <div className="p-6 space-y-6">
        {/* HEADER */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLayoutEditorOpen(false);
              setEditingLayout(null);
            }}
            className="h-9 w-9 rounded-full hover:bg-zinc-200 flex items-center justify-center text-zinc-650 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">
              {editingLayout.id ? "Edit invoice layout" : "Add invoice layout"}
            </h1>
            <p className="text-xs text-zinc-450 mt-0.5">
              Configure receipt headings, labels, product details display, and modules.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveLayout} className="space-y-6">
          {/* CARD 1: GENERAL */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Layout name:*
                </label>
                <input
                  type="text"
                  required
                  value={editingLayout.name || ""}
                  onChange={(e) =>
                    setEditingLayout({ ...editingLayout, name: e.target.value })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Design:*
                </label>
                <select
                  value={editingLayout.design || ""}
                  onChange={(e) =>
                    setEditingLayout({ ...editingLayout, design: e.target.value })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
                >
                  <option value="Slim (Recommended for thermal line receipt printer, 80mm paper size)">
                    Slim (Recommended for thermal line receipt printer, 80mm paper size)
                  </option>
                  <option value="Classic">Classic</option>
                  <option value="Elegant">Elegant</option>
                  <option value="Detailed">Detailed</option>
                </select>
                <span className="text-xs text-zinc-455 mt-1 block">
                  Used for browser based printing
                </span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 pt-2 border-t border-zinc-150">
              <div className="flex-1 space-y-4">
                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showLetterHead || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showLetterHead: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Show letter head</span>
                </label>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-extrabold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Letter Head:
                </label>
                <input
                  type="file"
                  disabled
                  className="block w-full text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-not-allowed"
                />
                <span className="text-xs text-zinc-400 mt-1 block whitespace-pre-line leading-relaxed">
                  Upload a letterhead image containing all details of your business. Letterhead will be added at the top of the invoices.
                  {"\n"}Max 1 MB, jpeg,gif,png formats only.
                  {"\n"}Upload only if you want to replace previous letterhead
                </span>
              </div>
            </div>
          </div>

          {/* CARD 2: HEADINGS */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Invoice heading:
                </label>
                <input
                  type="text"
                  placeholder="Invoice"
                  value={editingLayout.invoiceHeading || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      invoiceHeading: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Heading Suffix for not paid:
                </label>
                <input
                  type="text"
                  placeholder="Heading Suffix for not paid"
                  value={editingLayout.headingSuffixNotPaid || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      headingSuffixNotPaid: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Heading Suffix for paid:
                </label>
                <input
                  type="text"
                  placeholder="Heading Suffix for paid"
                  value={editingLayout.headingSuffixPaid || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      headingSuffixPaid: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Proforma invoice heading:
                </label>
                <input
                  type="text"
                  placeholder="Proforma invoice heading"
                  value={editingLayout.proformaInvoiceHeading || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      proformaInvoiceHeading: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1 flex items-center gap-1">
                  Quotation Heading:
                  <span title="Heading shown when printing quotes." className="cursor-pointer text-indigo-650">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Quotation Heading"
                  value={editingLayout.quotationHeading || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      quotationHeading: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Sales Order Heading:
                </label>
                <input
                  type="text"
                  placeholder="Sales Order Heading"
                  value={editingLayout.salesOrderHeading || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      salesOrderHeading: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Invoice no. label:
                </label>
                <input
                  type="text"
                  placeholder="Invoice No."
                  value={editingLayout.invoiceNoLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      invoiceNoLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Quotation no. label:
                </label>
                <input
                  type="text"
                  placeholder="Quotation no. label"
                  value={editingLayout.quotationNoLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      quotationNoLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Date Label:
                </label>
                <input
                  type="text"
                  placeholder="Date"
                  value={editingLayout.dateLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      dateLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Due date label:
                </label>
                <input
                  type="text"
                  placeholder="Due date label"
                  value={editingLayout.dueDateLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      dueDateLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showDueDate || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showDueDate: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Show due date</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Date time format:
                </label>
                <input
                  type="text"
                  placeholder="Date time format"
                  value={editingLayout.dateTimeFormat || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      dateTimeFormat: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
                <span className="text-xs text-zinc-400 mt-1 block leading-tight">
                  Enter date and time format in PHP datetime format. If blank business date time format will be applied
                </span>
              </div>
            </div>
          </div>

          {/* CARD 3: LABELS & CUSTOMER DETAILS */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Sales Person Label:
                </label>
                <input
                  type="text"
                  placeholder="Sales Person Label"
                  value={editingLayout.salesPersonLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      salesPersonLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Commission agent label:
                </label>
                <input
                  type="text"
                  placeholder="Commission agent label"
                  value={editingLayout.commissionAgentLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      commissionAgentLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>
            </div>

            <div className="border-t border-zinc-150 pt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editingLayout.showBusinessName || false}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      showBusinessName: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                />
                <span>Show business name</span>
              </label>

              <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editingLayout.showLocationName || false}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      showLocationName: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                />
                <span>Show location name</span>
              </label>

              <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editingLayout.showSalesPerson || false}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      showSalesPerson: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                />
                <span>Show Sales Person</span>
              </label>

              <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editingLayout.showCommissionAgent || false}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      showCommissionAgent: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                />
                <span>Show commission agent</span>
              </label>
            </div>

            {/* CUSTOMER DETAILS SUBSECTION */}
            <div className="border-t border-zinc-150 pt-5 space-y-4">
              <h3 className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider">
                Fields for customer details:
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                <div className="flex items-center h-10">
                  <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingLayout.showCustomerInfo || false}
                      onChange={(e) =>
                        setEditingLayout({
                          ...editingLayout,
                          showCustomerInfo: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                    />
                    <span>Show Customer information</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Customer Label:
                  </label>
                  <input
                    type="text"
                    placeholder="Customer"
                    value={editingLayout.customerLabel || ""}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        customerLabel: e.target.value,
                      })
                    }
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                <div className="flex items-center h-10">
                  <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingLayout.showClientId || false}
                      onChange={(e) =>
                        setEditingLayout({
                          ...editingLayout,
                          showClientId: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                    />
                    <span>Show client ID</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Client ID Label:
                  </label>
                  <input
                    type="text"
                    placeholder="Client ID Label"
                    value={editingLayout.clientIdLabel || ""}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        clientIdLabel: e.target.value,
                      })
                    }
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-1">
                    Client tax number label:
                  </label>
                  <input
                    type="text"
                    placeholder="Client tax number label"
                    value={editingLayout.clientTaxNumberLabel || ""}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        clientTaxNumberLabel: e.target.value,
                      })
                    }
                    className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                <div className="flex items-center h-10">
                  <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editingLayout.showRewardPoint || false}
                      onChange={(e) =>
                        setEditingLayout({
                          ...editingLayout,
                          showRewardPoint: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                    />
                    <span>Show reward point</span>
                  </label>
                </div>
              </div>

              {/* CUSTOMER CUSTOM FIELDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.customField1 || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        customField1: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Custom Field 1</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.customField2 || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        customField2: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Custom Field 2</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.customField3 || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        customField3: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Custom Field 3</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.customField4 || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        customField4: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Custom Field 4</span>
                </label>
              </div>
            </div>
          </div>

          {/* CARD 4: PRODUCT LABELS & DETAILS */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Product Label:
                </label>
                <input
                  type="text"
                  placeholder="Item"
                  value={editingLayout.productLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      productLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Quantity Label:
                </label>
                <input
                  type="text"
                  placeholder="Qty"
                  value={editingLayout.quantityLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      quantityLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Unit Price Label:
                </label>
                <input
                  type="text"
                  placeholder="Unit Price"
                  value={editingLayout.unitPriceLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      unitPriceLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Subtotal Label:
                </label>
                <input
                  type="text"
                  placeholder="Subtotal"
                  value={editingLayout.subtotalLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      subtotalLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Category or HSN code label:
                </label>
                <input
                  type="text"
                  placeholder="HSN or Category Code"
                  value={editingLayout.categoryOrHsnLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      categoryOrHsnLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Total quantity label:
                </label>
                <input
                  type="text"
                  placeholder="Total quantity label"
                  value={editingLayout.totalQuantityLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      totalQuantityLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Item discount label:
                </label>
                <input
                  type="text"
                  placeholder="Dis"
                  value={editingLayout.itemDiscountLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      itemDiscountLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Discounted unit price label:
                </label>
                <input
                  type="text"
                  placeholder="Discounted unit price label"
                  value={editingLayout.discountedUnitPriceLabel || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      discountedUnitPriceLabel: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>
            </div>

            {/* PRODUCT DETAILS TO BE SHOWN */}
            <div className="border-t border-zinc-150 pt-5 space-y-4">
              <h3 className="text-xs font-bold text-zinc-650">
                Product details to be shown:
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showBrand || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showBrand: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Show brand</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showSku || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showSku: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Show SKU</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showCategoryOrHsn || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showCategoryOrHsn: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Show category code or HSN code</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showSaleDesc || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showSaleDesc: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span>Show sale description</span>
                    <span className="text-xs text-zinc-400 font-normal">
                      (Product IMEI or Serial Number)
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showProductDesc || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showProductDesc: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Show product description</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.prodCustomField1 || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        prodCustomField1: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Custom Field1</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.prodCustomField2 || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        prodCustomField2: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Custom Field2</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.prodCustomField3 || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        prodCustomField3: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Custom Field3</span>
                </label>
              </div>
            </div>
          </div>

          {/* CARD 5: QR CODES & RECEIPT FIELDS */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editingLayout.showQrCode || false}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      showQrCode: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                />
                <span>Show QR Code</span>
              </label>

              <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editingLayout.showLabels || false}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      showLabels: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                />
                <span>Show Labels</span>
              </label>

              <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editingLayout.zatcaQrCode || false}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      zatcaQrCode: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  <span>ZATCA (Fatoora) QR code</span>
                  <span title="Zakat, Tax and Customs Authority compliant billing barcode format." className="cursor-pointer text-indigo-650">
                    <Info className="h-3.5 w-3.5" />
                  </span>
                </div>
              </label>
            </div>

            {/* FIELDS TO BE SHOWN LIST */}
            <div className="border-t border-zinc-150 pt-5 space-y-4">
              <h3 className="text-xs font-bold text-zinc-650">
                Fields to be shown:
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showBizName || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showBizName: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Business Name</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showBizAddress || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showBizAddress: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Business location address</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showBizTax1 || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showBizTax1: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Business tax 1</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showBizTax2 || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showBizTax2: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Business tax 2</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showInvoiceNo || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showInvoiceNo: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Invoice No.</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showInvoiceDatetime || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showInvoiceDatetime: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Invoice Datetime</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showSubtotal || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showSubtotal: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Subtotal</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showTotalWithTax || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showTotalWithTax: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Total amount with tax</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showTotalTax || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showTotalTax: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Total Tax</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showCustName || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showCustName: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Customer name</span>
                </label>

                <label className="flex items-center gap-2 font-bold text-xs text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editingLayout.showInvoiceUrl || false}
                    onChange={(e) =>
                      setEditingLayout({
                        ...editingLayout,
                        showInvoiceUrl: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                  />
                  <span>Invoice URL</span>
                </label>
              </div>
            </div>
          </div>

          {/* CARD 6: RESTAURANT MODULE */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-indigo-900 tracking-tight">
              Restaurant module settings
            </h3>
            <p className="text-xs text-zinc-450">
              Settings specifically for tables, kitchen status, orders, and waiters. Ready and integrated with layout structure.
            </p>
          </div>

          {/* CARD 7: CREDIT NOTE / RETURN */}
          <div className="bg-white rounded-lg border border-zinc-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-indigo-950 tracking-tight">
              Credit Note / Sell Return Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Heading:
                </label>
                <input
                  type="text"
                  placeholder="Heading"
                  value={editingLayout.creditNoteHeading || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      creditNoteHeading: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Reference Number:
                </label>
                <input
                  type="text"
                  placeholder="Reference Number"
                  value={editingLayout.creditNoteRefNo || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      creditNoteRefNo: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Total Amount:
                </label>
                <input
                  type="text"
                  placeholder="Total Amount"
                  value={editingLayout.creditNoteTotal || ""}
                  onChange={(e) =>
                    setEditingLayout({
                      ...editingLayout,
                      creditNoteTotal: e.target.value,
                    })
                  }
                  className="h-10 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON BAR */}
          <div className="flex justify-end p-2 bg-zinc-50 rounded-lg border border-zinc-200 shadow-sm">
            <button
              type="submit"
              className="bg-indigo-650 hover:bg-indigo-750 text-white px-8 py-3 rounded-lg text-xs font-extrabold shadow-md transition"
            >
              Update
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Invoice Settings</h1>
        <p className="text-xs text-zinc-450 mt-1">Manage your invoice settings</p>
      </div>

      {/* TABS CONTAINER */}
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        
        {/* TABS HEADER BAR */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-4">
          <button
            onClick={() => setActiveTab("schemes")}
            className={`px-5 py-4 text-sm font-extrabold tracking-wide transition border-b-2 select-none ${
              activeTab === "schemes"
                ? "border-indigo-600 text-indigo-650"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Invoice Schemes
          </button>
          <button
            onClick={() => setActiveTab("layouts")}
            className={`px-5 py-4 text-sm font-extrabold tracking-wide transition border-b-2 select-none ${
              activeTab === "layouts"
                ? "border-indigo-600 text-indigo-650"
                : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            Invoice Layouts
          </button>
        </div>

        {/* TAB CONTENTS PANEL */}
        <div className="flex-1 p-6 space-y-6">
          
          {/* TAB 1: INVOICE SCHEMES */}
          {activeTab === "schemes" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-sm font-extrabold text-indigo-950 uppercase tracking-wider">
                  All your invoice schemes
                </span>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* SEARCH */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 w-48 pl-9 pr-3 rounded border border-zinc-300 text-xs font-semibold outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>

                  {/* ADD BUTTON */}
                  <button
                    onClick={handleOpenAddScheme}
                    className="bg-indigo-650 hover:bg-indigo-750 text-white h-9 px-4 rounded font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* TABLE */}
              <div className="border border-zinc-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-zinc-50 text-zinc-650 font-extrabold border-b border-zinc-200 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-4 py-3">
                        <div className="flex items-center gap-1.5 cursor-pointer select-none">
                          Name
                          <span title="The naming profile identifier." className="cursor-pointer text-zinc-400">
                            <Info className="h-3 w-3" />
                          </span>
                        </div>
                      </th>
                      <th className="px-4 py-3">
                        <div className="flex items-center gap-1.5 cursor-pointer select-none">
                          Prefix
                          <span title="Text prefixed to invoice numbers." className="cursor-pointer text-zinc-400">
                            <Info className="h-3 w-3" />
                          </span>
                        </div>
                      </th>
                      <th className="px-4 py-3">
                        <div className="flex items-center gap-1.5 cursor-pointer select-none">
                          Numbering Type
                          <span title="Type of sequential pattern applied." className="cursor-pointer text-zinc-400">
                            <Info className="h-3 w-3" />
                          </span>
                        </div>
                      </th>
                      <th className="px-4 py-3">
                        <div className="flex items-center gap-1.5 cursor-pointer select-none">
                          Start from
                          <span title="Starting sequence number." className="cursor-pointer text-zinc-400">
                            <Info className="h-3 w-3" />
                          </span>
                        </div>
                      </th>
                      <th className="px-4 py-3">
                        <div className="flex items-center gap-1.5 cursor-pointer select-none">
                          Invoice Count
                          <span title="Number of generated receipts." className="cursor-pointer text-zinc-400">
                            <Info className="h-3 w-3" />
                          </span>
                        </div>
                      </th>
                      <th className="px-4 py-3">
                        <div className="flex items-center gap-1.5 cursor-pointer select-none">
                          Number of digits
                          <span title="Count of numerical digits in invoice string." className="cursor-pointer text-zinc-400">
                            <Info className="h-3 w-3" />
                          </span>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-800 text-sm">
                    {filteredSchemes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-zinc-400 text-xs">
                          No matching invoice schemes found.
                        </td>
                      </tr>
                    ) : (
                      filteredSchemes.map((scheme) => (
                        <tr key={scheme.id} className="hover:bg-zinc-50/50 transition">
                          <td className="px-4 py-3.5 font-bold">
                            <div className="flex flex-col items-start gap-1">
                              <span>{scheme.name}</span>
                              {scheme.isDefault && (
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-extrabold uppercase">
                                  Default
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-semibold text-zinc-650">
                            {scheme.prefix || "—"}
                          </td>
                          <td className="px-4 py-3.5 text-zinc-650 font-semibold">
                            {scheme.numberingType}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-zinc-600">
                            {scheme.startNumber}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-zinc-800">
                            {scheme.invoiceCount}
                          </td>
                          <td className="px-4 py-3.5 text-zinc-600">
                            {scheme.digits}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditScheme(scheme)}
                                className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2.5 py-1.5 rounded text-xs font-extrabold transition flex items-center gap-1 bg-white"
                              >
                                <Edit className="h-3 w-3" /> Edit
                              </button>
                              
                              <button
                                onClick={() => handleDeleteScheme(scheme.id)}
                                disabled={scheme.isDefault}
                                className={`border border-zinc-200 px-2.5 py-1.5 rounded text-xs font-extrabold transition flex items-center gap-1 ${
                                  scheme.isDefault
                                    ? "text-zinc-400 bg-zinc-50 cursor-not-allowed"
                                    : "text-zinc-600 hover:bg-zinc-100 bg-white"
                                }`}
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>

                              {!scheme.isDefault && (
                                <button
                                  onClick={() => handleSetDefaultScheme(scheme.id)}
                                  className="border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded text-xs font-extrabold transition flex items-center bg-white"
                                >
                                  Default
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* FOOTER PAGINATION PLACEHOLDER */}
              <div className="flex items-center justify-between text-xs text-zinc-450 pt-2 font-semibold">
                <span>
                  Showing 1 to {filteredSchemes.length} of {filteredSchemes.length} entries
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: INVOICE LAYOUTS */}
          {activeTab === "layouts" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-sm font-extrabold text-indigo-950 uppercase tracking-wider">
                  All your invoice layouts
                </span>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* SEARCH */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-zinc-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 w-48 pl-9 pr-3 rounded border border-zinc-300 text-xs font-semibold outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>

                  {/* ADD BUTTON */}
                  <button
                    onClick={handleOpenAddLayout}
                    className="bg-indigo-650 hover:bg-indigo-750 text-white h-9 px-4 rounded font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* LAYOUT LIST */}
              <div className="border border-zinc-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-zinc-50 text-zinc-655 font-extrabold border-b border-zinc-200 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-4 py-3">Layout Name</th>
                      <th className="px-4 py-3">Design Type</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-800 text-sm">
                    {filteredLayouts.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-zinc-400 text-xs">
                          No matching invoice layouts found.
                        </td>
                      </tr>
                    ) : (
                      filteredLayouts.map((layout) => (
                        <tr key={layout.id} className="hover:bg-zinc-50/50 transition">
                          <td className="px-4 py-3.5 font-bold">
                            <div className="flex flex-col items-start gap-1">
                              <span>{layout.name}</span>
                              {layout.isDefault && (
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-extrabold uppercase">
                                  Default
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-zinc-600 font-semibold">
                            {layout.design}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditLayout(layout)}
                                className="border border-blue-200 text-blue-650 hover:bg-blue-50 px-2.5 py-1.5 rounded text-xs font-extrabold transition flex items-center gap-1 bg-white"
                              >
                                <Edit className="h-3 w-3" /> Edit
                              </button>
                              
                              <button
                                onClick={() => handleDeleteLayout(layout.id)}
                                disabled={layout.isDefault}
                                className={`border border-zinc-200 px-2.5 py-1.5 rounded text-xs font-extrabold transition flex items-center gap-1 ${
                                  layout.isDefault
                                    ? "text-zinc-400 bg-zinc-50 cursor-not-allowed"
                                    : "text-zinc-600 hover:bg-zinc-100 bg-white"
                                }`}
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>

                              {!layout.isDefault && (
                                <button
                                  onClick={() => handleSetDefaultLayout(layout.id)}
                                  className="border border-indigo-200 text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded text-xs font-extrabold transition flex items-center bg-white"
                                >
                                  Default
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* FOOTER */}
              <div className="flex items-center justify-between text-xs text-zinc-450 pt-2 font-semibold">
                <span>
                  Showing 1 to {filteredLayouts.length} of {filteredLayouts.length} entries
                </span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL FOR SCHEME ADD/EDIT */}
      <Modal
        open={schemeModalOpen}
        onClose={() => setSchemeModalOpen(false)}
        title={editingScheme ? "Edit Invoice Scheme" : "Add Invoice Scheme"}
        className="max-w-lg"
      >
        <form onSubmit={handleSaveScheme} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              Scheme Name:*
            </label>
            <input
              type="text"
              required
              value={schemeName}
              onChange={(e) => setSchemeName(e.target.value)}
              className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              Prefix:
            </label>
            <input
              type="text"
              value={schemePrefix}
              onChange={(e) => setSchemePrefix(e.target.value)}
              className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              Numbering Type:
            </label>
            <select
              value={schemeNumType}
              onChange={(e) => setSchemeNumType(e.target.value)}
              className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 bg-white cursor-pointer"
            >
              <option value="Sequential">Sequential</option>
              <option value="Year Based">Year Based</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              Start from:
            </label>
            <input
              type="text"
              value={schemeStartFrom}
              onChange={(e) => setSchemeStartFrom(e.target.value)}
              className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">
              Number of digits:
            </label>
            <input
              type="text"
              value={schemeDigits}
              onChange={(e) => setSchemeDigits(e.target.value)}
              className="h-10 w-full rounded border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-150">
            <button
              type="button"
              onClick={() => setSchemeModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-zinc-550 border border-zinc-300 rounded hover:bg-zinc-550 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded hover:bg-indigo-700 transition"
            >
              Save Scheme
            </button>
          </div>
        </form>
      </Modal>

      {/* FOOTER BRANDING */}
      <div className="text-center text-xs text-zinc-405 pt-4 border-t border-zinc-200">
        Apple Tech POS - v6.7 | Copyright © 2026 All rights reserved.
      </div>
    </div>
  );
}
