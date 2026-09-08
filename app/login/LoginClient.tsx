"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Cog,
  Settings2,
  Disc,
  Gauge,
  Zap,
  Droplets,
  Filter,
  Car,
  CircleDot,
} from "lucide-react";

// Decorative only — a wide spread of parts categories to make the hero
// panel feel like an auto-parts counter rather than a generic app. Not
// tied to what's actually in the catalog (see prisma/seed.ts's category
// list), so this doesn't need to change if the product mix changes.
const CATEGORY_TILES = [
  { label: "Engine", Icon: Cog },
  { label: "Gear & Clutch", Icon: Settings2 },
  { label: "Brake System", Icon: Disc },
  { label: "Suspension", Icon: Gauge },
  { label: "Electrical", Icon: Zap },
  { label: "Cooling", Icon: Droplets },
  { label: "Filters & Oil", Icon: Filter },
  { label: "Body Parts", Icon: Car },
  { label: "Rubber Parts", Icon: CircleDot },
];

function BrandMark({ bizName, className = "" }: { bizName: string; className?: string }) {
  const initial = bizName.trim().charAt(0).toUpperCase() || "P";
  return (
    <div
      className={
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-750 text-lg font-black text-white shadow-lg shadow-indigo-900/30 " +
        className
      }
    >
      {initial}
    </div>
  );
}

/** Left hero panel — purely decorative branding, no interactivity, so it
 * doesn't need to live inside the Suspense boundary below. bizName is
 * fetched server-side by page.tsx (a plain Prisma read, not the
 * auth-gated /api/business-info — the login page is by definition the one
 * place a user is never authenticated yet, so that endpoint always 401s
 * here) and passed straight through as a prop. */
function HeroPanel({ bizName }: { bizName: string }) {
  return (
    <div className="relative hidden w-full max-w-md flex-col justify-center overflow-hidden bg-gradient-to-br from-zinc-900 via-indigo-950 to-zinc-950 px-10 py-12 lg:flex">
      {/* Decorative glow blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <BrandMark bizName={bizName} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black tracking-tight text-white">{bizName}</h1>
            <p className="text-xs font-medium text-indigo-300">Motor Parts &amp; Spares</p>
          </div>
        </div>

        <div>
          <p className="text-sm leading-relaxed text-zinc-400">
            Everything from engine internals to body trim — one counter, one system.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {CATEGORY_TILES.map(({ label, Icon }) => (
            <div
              key={label}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-5 text-center backdrop-blur-sm transition hover:bg-white/[0.08]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Icon className="h-[18px] w-[18px] text-indigo-200" strokeWidth={2} />
              </div>
              <span className="text-[11px] font-semibold leading-tight text-white/80">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoginForm({ bizName }: { bizName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      // `from` is attacker-controllable — anyone can send a victim a link
      // like /login?from=https://evil.example/phish and, after they log
      // in with real credentials, this would send them straight there. A
      // safe redirect target must be an internal path: starts with a
      // single "/" (rejecting "//evil.com" and "/\evil.com", both of
      // which browsers can treat as protocol-relative), and never "/login"
      // itself (which would just bounce back here).
      const from = searchParams.get("from");
      const isSafeInternalPath = (p: string | null): p is string =>
        !!p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") && p !== "/login";
      router.push(isSafeInternalPath(from) ? from : "/");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 text-sm outline-none " +
    "transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 " +
    "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-400/20";

  return (
    <main className="flex w-full flex-1 flex-col justify-center px-6 py-16 sm:px-10 lg:px-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        {/* Compact branding for narrow screens — the hero panel with the
            full tile grid is hidden below lg, so this is the only branding
            mobile users see. */}
        <div className="flex items-center gap-3 lg:hidden">
          <BrandMark bizName={bizName} />
          <h1 className="truncate text-xl font-black tracking-tight text-zinc-900 dark:text-white">{bizName}</h1>
        </div>

        <div>
          <h2 className="hidden text-xl font-semibold tracking-tight lg:block">Sign in</h2>
          <h2 className="text-xl font-semibold tracking-tight lg:hidden">Sign in to continue</h2>
          <p className="mt-1 text-sm text-zinc-500">Enter your credentials to access the register.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass + " pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} size="lg" className="mt-1">
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
      </div>
    </main>
  );
}

// Suspense boundary needed because LoginForm uses useSearchParams() which
// opts the component into client-side rendering and requires Suspense to
// avoid a flash of empty content during the server-to-client handoff.
// HeroPanel is intentionally outside the boundary — it's static/decorative
// so it doesn't need to wait on the client bundle.
export function LoginClient({ bizName }: { bizName: string }) {
  return (
    <div className="flex min-h-screen w-full">
      <HeroPanel bizName={bizName} />
      <Suspense
        fallback={
          <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
            <div className="flex flex-col gap-4">
              <div className="h-7 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
              <div className="mt-4 h-11 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-11 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
              <div className="h-11 animate-pulse rounded-lg bg-blue-100 dark:bg-blue-950/20" />
            </div>
          </main>
        }
      >
        <LoginForm bizName={bizName} />
      </Suspense>
    </div>
  );
}
