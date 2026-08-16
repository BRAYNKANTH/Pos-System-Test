"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Barcode from "react-barcode";
import { Search, Trash2, Printer } from "lucide-react";

interface ProductItem {
  sku: string;
  name: string;
  unitPrice: number;
  category: string | null;
  brand: string | null;
}

interface SelectedLabelProduct extends ProductItem {
  noOfLabels: number;
  expDate: string;
  packingDate: string;
  priceGroup: string;
}

interface PrintLabelsClientProps {
  products: ProductItem[];
}

export default function PrintLabelsClient({ products }: PrintLabelsClientProps) {
  const router = useRouter();

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Selected products for label printing
  const [selectedItems, setSelectedItems] = useState<SelectedLabelProduct[]>([]);

  // Configurations for label information to show
  const [showProductName, setShowProductName] = useState(true);
  const [productNameSize, setProductNameSize] = useState(13);

  const [showVariation, setShowVariation] = useState(true);
  const [variationSize, setVariationSize] = useState(17);

  const [showProductPrice, setShowProductPrice] = useState(true);
  const [productPriceSize, setProductPriceSize] = useState(15);
  const [priceTaxType, setPriceTaxType] = useState("Inc. tax");

  const [showBusinessName, setShowBusinessName] = useState(true);
  const [businessNameText, setBusinessNameText] = useState("Mektas Supers");
  const [businessNameSize, setBusinessNameSize] = useState(15);

  useEffect(() => {
    const saved = localStorage.getItem("biz_settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.bizName) {
          setBusinessNameText(parsed.bizName);
        }
      } catch (e) {}
    }
  }, []);

  const [showPackingDate, setShowPackingDate] = useState(true);
  const [packingDateSize, setPackingDateSize] = useState(12);

  const [showExpiryDate, setShowExpiryDate] = useState(true);
  const [expiryDateSize, setExpiryDateSize] = useState(12);

  const [barcodeSetting, setBarcodeSetting] = useState("20"); // 20 or 30 labels per sheet
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);

  // Search suggestions auto-filter
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, products]);

  // Handler to add product to print table
  const handleSelectProduct = (product: ProductItem) => {
    // Check if already in list
    if (selectedItems.find((item) => item.sku === product.sku)) {
      setSearchQuery("");
      setShowDropdown(false);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const expStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    setSelectedItems([
      ...selectedItems,
      {
        ...product,
        noOfLabels: 10,
        expDate: expStr,
        packingDate: todayStr,
        priceGroup: "Default Selling Price"
      }
    ]);
    setSearchQuery("");
    setShowDropdown(false);
  };

  // Remove item from table list
  const handleRemoveProduct = (sku: string) => {
    setSelectedItems(selectedItems.filter((item) => item.sku !== sku));
  };

  // Update item field values
  const handleUpdateItem = (
    sku: string,
    key: keyof SelectedLabelProduct,
    value: any
  ) => {
    setSelectedItems(
      selectedItems.map((item) =>
        item.sku === sku ? { ...item, [key]: value } : item
      )
    );
  };

  // Generate preview label grid cards list
  const previewLabels = useMemo(() => {
    const labels: {
      sku: string;
      name: string;
      price: number;
      expDate: string;
      packingDate: string;
      priceGroup: string;
    }[] = [];

    selectedItems.forEach((item) => {
      for (let i = 0; i < item.noOfLabels; i++) {
        labels.push({
          sku: item.sku,
          name: item.name,
          price: item.unitPrice,
          expDate: item.expDate,
          packingDate: item.packingDate,
          priceGroup: item.priceGroup
        });
      }
    });

    return labels;
  }, [selectedItems]);

  // Note: no sidebar/header shell here — app/inventory/layout.tsx already
  // provides one via the shared AppSidebar. This used to hand-duplicate a
  // second, independent copy (identical to the one that also existed in
  // add-product/page.tsx), stacking two sidebars on this page.
  return (
    <main className="flex-1 p-6 space-y-6 overflow-y-auto print:p-0 print:overflow-visible">

          <div className="flex items-center justify-between border-b pb-4 print:hidden">
            <div>
              <h1 className="text-2xl font-bold text-zinc-800 tracking-tight flex items-center gap-2">
                Print Labels
                <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-bold">Barcodes</span>
              </h1>
              <p className="text-sm text-zinc-455 mt-1">Configure barcode sheet details and print labels easily by searching products</p>
            </div>
          </div>

          {/* PRINTABLE PREVIEW CONTAINER */}
          {showPreviewSheet && previewLabels.length > 0 && (
            <div className="bg-white rounded-lg border border-zinc-200 p-6 shadow-sm space-y-5 print:border-0 print:p-0 print:shadow-none print:bg-white">
              
              <div className="flex items-center justify-between border-b pb-3 print:hidden">
                <span className="font-bold text-sm text-zinc-700">Generated Barcode Labels Sheet Preview ({previewLabels.length} total)</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="bg-indigo-650 hover:bg-indigo-750 text-white px-4.5 py-2 rounded-lg text-sm font-bold shadow-sm transition flex items-center gap-1.5"
                  >
                    <Printer className="h-4 w-4" /> Print Sheet
                  </button>
                  <button
                    onClick={() => setShowPreviewSheet(false)}
                    className="border border-zinc-300 hover:bg-zinc-50 px-4.5 py-2 rounded-lg text-sm font-bold text-zinc-650 transition"
                  >
                    Back to Edit
                  </button>
                </div>
              </div>

              {/* Barcode sheets template grid */}
              <div className={`grid gap-4 print:gap-2 ${
                barcodeSetting === "30" 
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5 print:grid-cols-3 print:w-[8.5in] print:mx-auto" 
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-2 print:w-[8.5in] print:mx-auto"
              }`}>
                {previewLabels.map((lbl, idx) => (
                  <div
                    key={idx}
                    className="border border-zinc-300 rounded p-3 bg-zinc-50 flex flex-col items-center justify-center text-center gap-1 shadow-xs print:border print:border-zinc-400 print:bg-white print:p-4 print:h-[2in] print:w-[3.5in] overflow-hidden"
                  >
                    {showBusinessName && (
                      <div className="font-bold text-zinc-800 leading-tight print:text-black uppercase" style={{ fontSize: `${businessNameSize}px` }}>
                        {businessNameText}
                      </div>
                    )}
                    {showProductName && (
                      <div className="font-semibold text-zinc-700 leading-tight print:text-black mt-0.5" style={{ fontSize: `${productNameSize}px` }}>
                        {lbl.name}
                      </div>
                    )}
                    
                    {/* Real Code128 barcode generated from SKU */}
                    <div className="py-1 flex flex-col items-center">
                      <Barcode
                        value={lbl.sku || "000000"}
                        format="CODE128"
                        width={1.2}
                        height={36}
                        displayValue={true}
                        fontSize={9}
                        textMargin={2}
                        margin={0}
                        background="transparent"
                        lineColor="#000000"
                      />
                    </div>

                    {showProductPrice && (
                      <div className="font-extrabold text-indigo-700 print:text-black leading-none" style={{ fontSize: `${productPriceSize}px` }}>
                        Rs {lbl.price.toFixed(2)} <span className="text-[11px] font-bold text-zinc-400 print:text-black">({priceTaxType})</span>
                      </div>
                    )}

                    <div className="flex gap-2 text-[11px] font-bold text-zinc-450 mt-1 print:text-black">
                      {showPackingDate && (
                        <span>Pkg: {lbl.packingDate}</span>
                      )}
                      {showExpiryDate && (
                        <span>Exp: {lbl.expDate}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* MAIN CONFIGURATION CARDS */}
          {!showPreviewSheet && (
            <div className="space-y-6 print:hidden">

              {/* CARD 1: SEARCH PRODUCTS */}
              <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-xs space-y-4">
                <span className="block text-sm font-bold text-zinc-700">Add products to generate Labels</span>
                
                {/* Search Bar Input */}
                <div className="relative max-w-2xl">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-zinc-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Enter products name to print labels"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="h-11 w-full pl-10 pr-3 rounded border border-zinc-350 text-sm outline-none focus:border-indigo-500 bg-white"
                  />

                  {/* Autocomplete Suggestion Dropdown */}
                  {showDropdown && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-12 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg z-30 max-h-60 overflow-y-auto">
                      {suggestions.map((p) => (
                        <button
                          key={p.sku}
                          onClick={() => handleSelectProduct(p)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-50 flex items-center justify-between border-b last:border-b-0"
                        >
                          <span className="font-semibold text-zinc-800">{p.name}</span>
                          <span className="text-xs font-mono text-zinc-450 bg-zinc-100 px-2 py-0.5 rounded">{p.sku}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {showDropdown && searchQuery.trim() && suggestions.length === 0 && (
                    <div className="absolute left-0 right-0 top-12 mt-1 bg-white border border-zinc-200 rounded-md p-4 text-center text-sm text-zinc-450 z-30">
                      No matching products found
                    </div>
                  )}
                </div>

                {/* Selected Products Table */}
                <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-50 text-zinc-650 font-bold border-b border-zinc-200 text-xs">
                      <tr>
                        <th className="px-4 py-3">Products</th>
                        <th className="px-4 py-3 w-32">No. of labels</th>
                        <th className="px-4 py-3 w-44">EXP Date</th>
                        <th className="px-4 py-3 w-44">Packing Date</th>
                        <th className="px-4 py-3">Selling Price Group</th>
                        <th className="px-4 py-3 w-16 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {selectedItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400 font-medium">
                            Search and select products to generate barcodes.
                          </td>
                        </tr>
                      ) : (
                        selectedItems.map((item) => (
                          <tr key={item.sku} className="hover:bg-zinc-50/50 transition">
                            <td className="px-4 py-3.5">
                              <p className="font-bold text-zinc-800 leading-tight">{item.name}</p>
                              <p className="text-xs font-mono text-zinc-400 mt-0.5">{item.sku}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <input
                                type="number"
                                min={1}
                                max={200}
                                value={item.noOfLabels}
                                onChange={(e) => handleUpdateItem(item.sku, "noOfLabels", parseInt(e.target.value) || 1)}
                                className="h-9 w-20 rounded border border-zinc-300 px-2 text-center text-sm font-semibold outline-none focus:border-indigo-500 bg-white"
                              />
                            </td>
                            <td className="px-4 py-3.5">
                              <input
                                type="date"
                                value={item.expDate}
                                onChange={(e) => handleUpdateItem(item.sku, "expDate", e.target.value)}
                                className="h-9 w-36 rounded border border-zinc-300 px-2.5 text-xs outline-none focus:border-indigo-500 bg-white"
                              />
                            </td>
                            <td className="px-4 py-3.5">
                              <input
                                type="date"
                                value={item.packingDate}
                                onChange={(e) => handleUpdateItem(item.sku, "packingDate", e.target.value)}
                                className="h-9 w-36 rounded border border-zinc-300 px-2.5 text-xs outline-none focus:border-indigo-500 bg-white"
                              />
                            </td>
                            <td className="px-4 py-3.5">
                              <select
                                value={item.priceGroup}
                                onChange={(e) => handleUpdateItem(item.sku, "priceGroup", e.target.value)}
                                className="h-9 w-full max-w-[200px] rounded border border-zinc-300 px-2 text-xs outline-none focus:border-indigo-500 bg-white"
                              >
                                <option value="Default Selling Price">Default Selling Price</option>
                                <option value="Retail customer group">Retail customer group</option>
                              </select>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <button
                                onClick={() => handleRemoveProduct(item.sku)}
                                className="text-red-650 hover:bg-red-50 p-2 rounded transition"
                                title="Remove item"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* CARD 2: CONFIGURATION INFO OPTIONS */}
              <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-xs space-y-5">
                <span className="block text-sm font-bold text-zinc-700 border-b pb-2">Information to show in Labels</span>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  
                  {/* Name size checkbox */}
                  <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showName"
                        checked={showProductName}
                        onChange={(e) => setShowProductName(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                      />
                      <label htmlFor="showName" className="text-sm font-bold text-zinc-750 cursor-pointer select-none">Product Name</label>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-550">
                      <span>Size</span>
                      <input
                        type="number"
                        disabled={!showProductName}
                        value={productNameSize}
                        onChange={(e) => setProductNameSize(parseInt(e.target.value) || 12)}
                        className="h-7 w-16 rounded border border-zinc-300 px-2 text-center text-xs outline-none focus:border-indigo-500 bg-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Variation size checkbox */}
                  <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showVar"
                        checked={showVariation}
                        onChange={(e) => setShowVariation(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                      />
                      <label htmlFor="showVar" className="text-sm font-bold text-zinc-750 cursor-pointer select-none">Product Variation</label>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-550">
                      <span>Size</span>
                      <input
                        type="number"
                        disabled={!showVariation}
                        value={variationSize}
                        onChange={(e) => setVariationSize(parseInt(e.target.value) || 12)}
                        className="h-7 w-16 rounded border border-zinc-300 px-2 text-center text-xs outline-none focus:border-indigo-500 bg-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Price size checkbox */}
                  <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showPrice"
                        checked={showProductPrice}
                        onChange={(e) => setShowProductPrice(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                      />
                      <label htmlFor="showPrice" className="text-sm font-bold text-zinc-750 cursor-pointer select-none">Product Price</label>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-550">
                      <span>Size</span>
                      <input
                        type="number"
                        disabled={!showProductPrice}
                        value={productPriceSize}
                        onChange={(e) => setProductPriceSize(parseInt(e.target.value) || 12)}
                        className="h-7 w-16 rounded border border-zinc-300 px-2 text-center text-xs outline-none focus:border-indigo-500 bg-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Show Price Type Select */}
                  <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
                    <span className="block text-xs font-bold text-zinc-555 uppercase tracking-wider">Show Price:</span>
                    <select
                      value={priceTaxType}
                      onChange={(e) => setPriceTaxType(e.target.value)}
                      className="h-8 w-full rounded border border-zinc-300 px-2 text-xs outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="Inc. tax">Inc. tax</option>
                      <option value="Exc. tax">Exc. tax</option>
                    </select>
                  </div>

                  {/* Business name size checkbox */}
                  <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showBus"
                        checked={showBusinessName}
                        onChange={(e) => setShowBusinessName(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                      />
                      <label htmlFor="showBus" className="text-sm font-bold text-zinc-750 cursor-pointer select-none">Business name</label>
                    </div>
                    <input
                      type="text"
                      disabled={!showBusinessName}
                      value={businessNameText}
                      onChange={(e) => setBusinessNameText(e.target.value)}
                      className="h-8 w-full rounded border border-zinc-300 px-2 text-xs outline-none focus:border-indigo-500 bg-white disabled:opacity-50 font-semibold text-zinc-700"
                    />
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-555">
                      <span>Size</span>
                      <input
                        type="number"
                        disabled={!showBusinessName}
                        value={businessNameSize}
                        onChange={(e) => setBusinessNameSize(parseInt(e.target.value) || 12)}
                        className="h-7 w-16 rounded border border-zinc-300 px-2 text-center text-xs outline-none focus:border-indigo-500 bg-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Print packing date size checkbox */}
                  <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showPack"
                        checked={showPackingDate}
                        onChange={(e) => setShowPackingDate(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                      />
                      <label htmlFor="showPack" className="text-sm font-bold text-zinc-750 cursor-pointer select-none">Print packing date</label>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-555">
                      <span>Size</span>
                      <input
                        type="number"
                        disabled={!showPackingDate}
                        value={packingDateSize}
                        onChange={(e) => setPackingDateSize(parseInt(e.target.value) || 12)}
                        className="h-7 w-16 rounded border border-zinc-300 px-2 text-center text-xs outline-none focus:border-indigo-500 bg-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Print expiry date size checkbox */}
                  <div className="space-y-2 border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="showExp"
                        checked={showExpiryDate}
                        onChange={(e) => setShowExpiryDate(e.target.checked)}
                        className="h-4 w-4 rounded text-indigo-650 cursor-pointer"
                      />
                      <label htmlFor="showExp" className="text-sm font-bold text-zinc-750 cursor-pointer select-none">Print expiry date</label>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-555">
                      <span>Size</span>
                      <input
                        type="number"
                        disabled={!showExpiryDate}
                        value={expiryDateSize}
                        onChange={(e) => setExpiryDateSize(parseInt(e.target.value) || 12)}
                        className="h-7 w-16 rounded border border-zinc-300 px-2 text-center text-xs outline-none focus:border-indigo-500 bg-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                </div>

                <div className="border-t border-dashed border-zinc-250 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Barcode layout format dropdown */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-zinc-700">Barcode setting:</span>
                    <select
                      value={barcodeSetting}
                      onChange={(e) => setBarcodeSetting(e.target.value)}
                      className="h-9 rounded border border-zinc-300 px-3 text-xs font-semibold outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="20">20 Labels per Sheet, Sheet Size: 8.5" x 11"</option>
                      <option value="30">30 Labels per Sheet, Sheet Size: 8.5" x 11"</option>
                    </select>
                  </div>

                  <button
                    disabled={selectedItems.length === 0}
                    onClick={() => setShowPreviewSheet(true)}
                    className="bg-indigo-650 hover:bg-indigo-750 text-white px-8 py-3 rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Preview
                  </button>

                </div>

              </div>

            </div>
          )}

    </main>
  );
}
