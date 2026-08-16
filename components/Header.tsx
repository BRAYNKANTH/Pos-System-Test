import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "./LogoutButton";

// Server component — reads the session directly, no client fetch needed.
// Renders nothing on /login (no user yet).
export async function Header() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <header
      id="app-header"
      className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
    >
      <Link href="/" className="font-semibold">
        Cloud POS
      </Link>
      <div className="flex items-center gap-3">
        <span className="text-zinc-500">
          {user.name} · {user.role}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
