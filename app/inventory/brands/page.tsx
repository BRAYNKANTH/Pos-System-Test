import { TaxonomyManager } from "../_components/TaxonomyManager";

export const dynamic = "force-dynamic";

export default function BrandsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Brands</h1>
        <p className="text-xs text-zinc-450 mt-1">Manage the product brands in use across your catalog</p>
      </div>
      <TaxonomyManager label="Brand" apiPath="/api/inventory/brands" />
    </div>
  );
}
