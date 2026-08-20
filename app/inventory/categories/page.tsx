import { TaxonomyManager } from "../_components/TaxonomyManager";

export const dynamic = "force-dynamic";

export default function CategoriesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">Categories</h1>
        <p className="text-xs text-zinc-450 mt-1">Manage the product categories in use across your catalog</p>
      </div>
      <TaxonomyManager label="Category" apiPath="/api/inventory/categories" />
    </div>
  );
}
