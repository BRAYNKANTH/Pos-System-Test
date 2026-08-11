"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Plus,
  PlusCircle,
  HelpCircle,
  Upload,
} from "lucide-react";

export default function AddProductPage() {
  const router = useRouter();


  // Form fields state
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcodeType, setBarcodeType] = useState("C128");
  
  // Dynamic lists with option to quick-add
  const [units, setUnits] = useState(["Pc(s)", "Box(es)", "Kg", "Bottle(s)"]);
  const [selectedUnit, setSelectedUnit] = useState("");
  
  const [brands, setBrands] = useState(["House Blend", "AquaPure", "Citrus Co", "CrispCo", "In-House"]);
  const [selectedBrand, setSelectedBrand] = useState("");
  
  const [categories, setCategories] = useState(["Beverages", "Bakery", "Groceries", "Snacks"]);
  const [selectedCategory, setSelectedCategory] = useState("");

  const [alertQty, setAlertQty] = useState("10");
  const [openingStock, setOpeningStock] = useState("0");
  const [manageStock, setManageStock] = useState(true);
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    }
  };
  const [weight, setWeight] = useState("");
  const [prepTime, setPrepTime] = useState("");

  // Price matrix state
  const [excTaxPurchase, setExcTaxPurchase] = useState("0.00");
  const [marginPercent, setMarginPercent] = useState("25.00");
  const [incTaxPurchase, setIncTaxPurchase] = useState("0.00");
  const [excTaxSelling, setExcTaxSelling] = useState("0.00");
  const [applicableTax, setApplicableTax] = useState("None");
  const [taxType, setTaxType] = useState("Exclusive");
  const [productType, setProductType] = useState("Single");

  // Notifications/Errors
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Auto-generate SKU if blank on load
  useEffect(() => {
    const randomSku = "SKU-" + Math.floor(100000 + Math.random() * 900000);
    setSku(randomSku);
  }, []);

  // Sync pricing calculations
  const calculateSellingPrice = (purchase: string, margin: string) => {
    const p = parseFloat(purchase) || 0;
    const m = parseFloat(margin) || 0;
    const sell = p * (1 + m / 100);
    setExcTaxSelling(sell.toFixed(2));
    setIncTaxPurchase(p.toFixed(2)); // Simplified: no tax inc.
  };

  const handlePurchaseChange = (val: string) => {
    setExcTaxPurchase(val);
    calculateSellingPrice(val, marginPercent);
  };

  const handleMarginChange = (val: string) => {
    setMarginPercent(val);
    calculateSellingPrice(excTaxPurchase, val);
  };

  const handleSellingChange = (val: string) => {
    setExcTaxSelling(val);
    // Back-calculate margin
    const p = parseFloat(excTaxPurchase) || 0;
    const s = parseFloat(val) || 0;
    if (p > 0) {
      const m = ((s - p) / p) * 100;
      setMarginPercent(m.toFixed(2));
    }
  };

  // Quick creators
  const quickAddUnit = () => {
    const val = prompt("Enter new Unit name:");
    if (val) {
      setUnits([...units, val]);
      setSelectedUnit(val);
    }
  };

  const quickAddBrand = () => {
    const val = prompt("Enter new Brand name:");
    if (val) {
      setBrands([...brands, val]);
      setSelectedBrand(val);
    }
  };

  const quickAddCategory = () => {
    const val = prompt("Enter new Category name:");
    if (val) {
      setCategories([...categories, val]);
      setSelectedCategory(val);
    }
  };

  // Save submit handler
  const handleSave = async (mode: "save" | "save_another" | "save_stock") => {
    if (!name.trim()) {
      setErrorMsg("Product name is required.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!sku.trim()) {
      setErrorMsg("SKU is required.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sku,
          category: selectedCategory || null,
          brand: selectedBrand || null,
          unitPrice: parseFloat(excTaxSelling) || 0,
          purchasePrice: parseFloat(excTaxPurchase) || 0,
          qtyOnHand: parseInt(openingStock) || 0,
          lowStockThreshold: parseInt(alertQty) || 0
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save product.");
      }

      setSuccessMsg(`Successfully saved product "${name}"!`);
      
      setTimeout(() => {
        if (mode === "save") {
          router.push("/inventory");
        } else if (mode === "save_stock") {
          router.push(`/inventory?addStockSku=${sku}`);
        } else {
          // Reset form for adding another
          setName("");
          const randomSku = "SKU-" + Math.floor(100000 + Math.random() * 900000);
          setSku(randomSku);
          setExcTaxPurchase("0.00");
          setMarginPercent("25.00");
          setExcTaxSelling("0.00");
          setIncTaxPurchase("0.00");
          setImagePreview(null);
          setOpeningStock("0");
          setSuccessMsg("");
        }
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  // Note: no sidebar/header shell here — app/inventory/layout.tsx (which
  // wraps every /inventory/* route, including this page) already renders
  // one via the shared AppSidebar. This used to hand-duplicate a second,
  // independent copy of the entire sidebar/header chrome, which rendered
  // literally two sidebars stacked on this page and was the third of
  // three near-identical hand-copied sidebars in the codebase.
  return (
    <main className="flex-1 p-6 space-y-6 overflow-y-auto">

          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-zinc-800 tracking-tight">Add new product</h1>
          </div>

          {/* Error and Success Alert Banners */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm font-semibold flex items-center gap-2">
              <PlusCircle className="h-4.5 w-4.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* CARD 1: Core Details */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-xs space-y-5">
            
            {/* Input fields grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Product Name:*</label>
                <input
                  type="text"
                  placeholder="Product Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">SKU:</label>
                  <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="SKU"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm font-mono outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Barcode Type:*</label>
                <select
                  value={barcodeType}
                  onChange={(e) => setBarcodeType(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="C128">Code 128 (C128)</option>
                  <option value="C39">Code 39</option>
                  <option value="EAN13">EAN-13</option>
                  <option value="UPCA">UPC-A</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Unit:*</label>
                <div className="flex gap-1.5">
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="h-9 flex-1 rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">Please Select</option>
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={quickAddUnit} className="h-9 w-9 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded flex items-center justify-center border border-blue-200 transition">
                    <Plus className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Brand:</label>
                <div className="flex gap-1.5">
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="h-9 flex-1 rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">Please Select</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <button onClick={quickAddBrand} className="h-9 w-9 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded flex items-center justify-center border border-blue-200 transition">
                    <Plus className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Category:</label>
                <div className="flex gap-1.5">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-9 flex-1 rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="">Please Select</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={quickAddCategory} className="h-9 w-9 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded flex items-center justify-center border border-blue-200 transition">
                    <Plus className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">Business Locations:</label>
                  <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <div className="h-9 w-full rounded border border-zinc-300 px-3 flex items-center bg-zinc-50 text-xs font-semibold text-zinc-650">
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded mr-1">Mektas Supers (BL0001)</span>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">Alert quantity:</label>
                  <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <input
                  type="number"
                  placeholder="Alert quantity"
                  value={alertQty}
                  onChange={(e) => setAlertQty(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">Opening Stock Quantity:</label>
                  <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
                <p className="text-xs text-zinc-450 mt-1">Goes straight into inventory at Mektas Supers — leave at 0 to add stock later.</p>
              </div>

            </div>

            {/* Checkbox manage stock */}
            <div className="flex items-start gap-2.5 pt-2">
              <input
                type="checkbox"
                id="manageStock"
                checked={manageStock}
                onChange={(e) => setManageStock(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
              />
              <div>
                <label htmlFor="manageStock" className="block text-sm font-bold text-zinc-750 cursor-pointer">Manage Stock?</label>
                <p className="text-xs text-zinc-450 mt-0.5">Enable stock management at product level</p>
              </div>
            </div>

            {/* Description and files select grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Product Description:</label>
                
                {/* Visual rich text editor header placeholder */}
                <div className="border border-zinc-300 rounded-lg overflow-hidden bg-white">
                  <div className="bg-zinc-50 border-b border-zinc-200 px-3.5 py-2 flex flex-wrap gap-2 text-xs text-zinc-650 font-bold border-dashed select-none">
                    <span>File</span> <span>Edit</span> <span>View</span> <span>Insert</span> <span>Format</span> <span>Tools</span> <span>Table</span> <span>Help</span>
                    <span className="mx-1.5 border-l border-zinc-300"></span>
                    <span className="font-bold underline cursor-pointer">B</span> <span className="italic cursor-pointer">I</span>
                  </div>
                  <textarea
                    rows={6}
                    placeholder="Describe your product here..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-4 text-sm outline-none resize-none bg-white"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Product image:</label>
                  <label htmlFor="imgUpload" className="border border-dashed border-zinc-300 rounded-lg p-4 bg-zinc-50 hover:bg-zinc-100 transition flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer select-none">
                    <input
                      type="file"
                      id="imgUpload"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded border border-zinc-200" />
                    ) : (
                      <Upload className="h-6 w-6 text-zinc-400" />
                    )}
                    <span className="text-xs font-bold text-zinc-700">{imagePreview ? "Change Image" : "Browse Image"}</span>
                    <span className="text-xs text-zinc-400">Max size 5MB · 1:1 Aspect ratio</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Product brochure:</label>
                  <input
                    type="file"
                    className="block w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 file:hover:bg-zinc-250 cursor-pointer"
                  />
                  <p className="text-xs text-zinc-450 mt-1">Allowed File: .pdf, .csv, .zip, .jpg, .png. Max size: 5MB</p>
                </div>
              </div>
            </div>

          </div>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* CARD 2: Physical Properties */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-xs space-y-4">
            
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="imei" className="h-4 w-4 rounded text-indigo-650 cursor-pointer" />
                <label htmlFor="imei" className="text-xs font-bold text-zinc-750 cursor-pointer">Enable Product description, IMEI or Serial Number</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="nfs" className="h-4 w-4 rounded text-indigo-650 cursor-pointer" />
                <label htmlFor="nfs" className="text-xs font-bold text-zinc-750 cursor-pointer">Not for selling</label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Weight:</label>
                <input
                  type="text"
                  placeholder="Weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Service staff timer/Prep time (mins):</label>
                <input
                  type="number"
                  placeholder="Prep time"
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                />
              </div>
            </div>

          </div>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* CARD 3: Pricing Matrix */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-zinc-200 p-5 shadow-xs space-y-5">
            
            {/* Headers row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Applicable Tax:</label>
                <select
                  value={applicableTax}
                  onChange={(e) => setApplicableTax(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="None">None</option>
                  <option value="VAT8">VAT 8%</option>
                  <option value="VAT15">VAT 15%</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Selling Price Tax Type:*</label>
                <select
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="Exclusive">Exclusive</option>
                  <option value="Inclusive">Inclusive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider mb-1.5">Product Type:*</label>
                <select
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="h-9 w-full rounded border border-zinc-300 px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="Single">Single</option>
                  <option value="Variable">Variable</option>
                  <option value="Combo">Combo</option>
                </select>
              </div>
            </div>

            {/* Pricing table (green header grid) */}
            <div className="border border-zinc-200 rounded-lg overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-4 bg-green-600 text-white text-xs font-bold border-b border-zinc-200">
                  <div className="px-4 py-2 border-r border-green-700 text-center">Default Purchase Price</div>
                  <div className="px-4 py-2 border-r border-green-700 text-center">x Margin(%)</div>
                  <div className="px-4 py-2 border-r border-green-700 text-center">Default Selling Price</div>
                  <div className="px-4 py-2 text-center">Product image</div>
                </div>

                <div className="grid grid-cols-4 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-500 select-none">
                  <div className="grid grid-cols-2 border-r border-zinc-200 text-center border-dashed">
                    <div className="py-1.5 border-r border-zinc-250">Exc. tax:*</div>
                    <div className="py-1.5">Inc. tax:*</div>
                  </div>
                  <div className="py-1.5 border-r border-zinc-200 text-center">Margin %</div>
                  <div className="py-1.5 border-r border-zinc-200 text-center">Exc. Tax</div>
                  <div className="py-1.5 text-center">Choose Files</div>
                </div>

                <div className="grid grid-cols-4 bg-white items-center">
                  
                  {/* Purchase fields */}
                  <div className="grid grid-cols-2 border-r border-zinc-200 h-full py-3 px-3 gap-2 border-dashed">
                    <input
                      type="text"
                      value={excTaxPurchase}
                      onChange={(e) => handlePurchaseChange(e.target.value)}
                      className="h-9 w-full rounded border border-zinc-300 px-2 text-center text-xs font-mono outline-none focus:border-indigo-500 bg-white"
                    />
                    <input
                      type="text"
                      value={incTaxPurchase}
                      readOnly
                      className="h-9 w-full rounded border border-zinc-200 px-2 text-center text-xs font-mono bg-zinc-50 text-zinc-500 select-none"
                    />
                  </div>

                  {/* Margin */}
                  <div className="border-r border-zinc-200 h-full py-3 px-3 flex items-center justify-center">
                    <input
                      type="text"
                      value={marginPercent}
                      onChange={(e) => handleMarginChange(e.target.value)}
                      className="h-9 w-24 rounded border border-zinc-300 px-2 text-center text-xs font-mono outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>

                  {/* Selling Price */}
                  <div className="border-r border-zinc-200 h-full py-3 px-3 flex items-center justify-center">
                    <input
                      type="text"
                      value={excTaxSelling}
                      onChange={(e) => handleSellingChange(e.target.value)}
                      className="h-9 w-28 rounded border border-zinc-300 px-2 text-center text-xs font-mono outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>

                  {/* Image upload */}
                  <div className="py-3 px-3 flex flex-col items-center justify-center text-center">
                    <input
                      type="file"
                      className="text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-zinc-300 file:text-xs file:bg-zinc-50 file:text-zinc-650 cursor-pointer"
                    />
                    <span className="text-[11px] text-zinc-400 mt-1">1:1 Aspect ratio</span>
                  </div>

                </div>
              </div>
            </div>

          </div>

          {/* ────────────────────────────────────────────────────────────────── */}
          {/* FORM FOOTER ACTIONS */}
          {/* ────────────────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-end gap-3.5 bg-white border border-zinc-200 rounded-lg p-5 shadow-xs">
            
            <button
              onClick={() => handleSave("save_stock")}
              disabled={loading}
              className="bg-indigo-700 hover:bg-indigo-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50"
            >
              Save & Add Opening Stock
            </button>

            <button
              onClick={() => handleSave("save_another")}
              disabled={loading}
              className="bg-rose-700 hover:bg-rose-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50"
            >
              Save And Add Another
            </button>

            <button
              onClick={() => handleSave("save")}
              disabled={loading}
              className="bg-indigo-500 hover:bg-indigo-650 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>

          </div>

    </main>
  );
}
