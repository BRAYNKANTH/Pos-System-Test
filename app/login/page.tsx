"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!body.success) {
        setError(body.error?.message ?? "Login failed");
        return;
      }
      const from = searchParams.get("from");
      router.push(from && from !== "/login" ? from : "/");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 text-sm outline-none " +
    "transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 " +
    "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Cloud POS System</h1>
        <p className="mt-1 text-sm text-zinc-500">Sign in to continue.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="mt-1">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* Seed credentials — only shown in development to avoid leaking
          test accounts in production deployments. */}
      {process.env.NODE_ENV === "development" && (
        <p className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
          <strong>Dev logins:</strong> admin@pos.local / Admin123! · cashier@pos.local / Cashier123!
        </p>
      )}
    </main>
  );
}

// Suspense boundary needed because LoginForm uses useSearchParams() which
// opts the component into client-side rendering and requires Suspense to
// avoid a flash of empty content during the server-to-client handoff.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
          <div className="flex flex-col gap-4">
            <div className="h-7 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            <div className="mt-4 h-9 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-9 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
            <div className="h-9 animate-pulse rounded-lg bg-blue-100 dark:bg-blue-950/20" />
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
