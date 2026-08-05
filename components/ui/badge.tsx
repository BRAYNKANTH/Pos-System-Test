import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Used for the approval-queue pattern (Modules 2 & 3) and status pills
// elsewhere (sync status, order status, etc). Map your domain status
// string to one of these variants at the call site.
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
        success: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
        warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        destructive: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
