"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type POSProduct = { sku: string; name: string; unitPrice: number; purchasePrice: number; qtyOnHand: number;
  category: string | null; brand: string | null; isScaleItem: boolean; isReturnable: boolean; trackBatch: boolean; trackSerial: boolean;
  isNetPriceItem?: boolean };
export async function findProducts(query = "", options: { exact?: boolean; category?: string | null; brand?: string | null; page?: number } = {}, signal?: AbortSignal) {
  const params = new URLSearchParams({ query, limit: "48", offset: String((options.page ?? 0) * 48) });
  if (options.exact) params.set("exact", "1");
  if (options.category) params.set("category", options.category);
  if (options.brand) params.set("brand", options.brand);
  const res = await fetch(`/api/pos/products?${params}`, { signal });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? "Could not load products. Try again.");
  return { products: body.data as POSProduct[], hasMore: Boolean(body.meta?.hasMore) };
}
export function useProducts(query = "", category?: string | null, brand?: string | null, page = 0) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => { const t = setTimeout(() => setDebounced(query), 180); return () => clearTimeout(t); }, [query]);
  const client = useQueryClient();
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: ["products"] }); void client.invalidateQueries({ queryKey: ["sale-quote"] }); };
    window.addEventListener("pos-stock-changed", refresh);
    return () => window.removeEventListener("pos-stock-changed", refresh);
  }, [client]);
  const result = useQuery({ queryKey: ["products", debounced, category, brand, page],
    queryFn: ({ signal }) => findProducts(debounced, { category, brand, page }, signal), staleTime: 15000,
    refetchInterval: 60000, refetchOnWindowFocus: true, retry: 1 });
  return { ...result, products: query === debounced ? result.data?.products ?? [] : [], hasMore: result.data?.hasMore ?? false,
    searching: result.isFetching || query !== debounced };
}
