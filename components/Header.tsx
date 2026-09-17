import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "./LogoutButton";
import { CartRecovery } from "./CartRecovery";

// Server component — reads the session directly, no client fetch needed.
// Renders nothing on /login (no user yet).
export async function Header() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <header
      id="app-header"
      className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 text-base dark:border-zinc-800"
    >
      <CartRecovery userId={user.id} />
      <Link href="/" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
        Cloud POS
      </Link>
      <div className="flex items-center gap-4">
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {user.name} · {user.role}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
