import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Indigo, not blue — the app's actual established primary color (the
  // dashboard chrome, sidebar, and ~26 hand-built pages all use
  // indigo-650/750). This component was still blue from an earlier
  // decision that got superseded by later work, making it the one
  // inconsistent primary button in the app instead of the shared source
  // of truth it's meant to be.
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold tracking-tight transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        default: "bg-indigo-650 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-750 hover:shadow-md hover:shadow-indigo-600/25 dark:bg-indigo-500 dark:hover:bg-indigo-400",
        outline:
          "border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:border-zinc-300 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-zinc-900",
        destructive: "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-500 hover:shadow-md hover:shadow-red-600/25",
        ghost: "hover:bg-zinc-100 dark:hover:bg-zinc-900",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-[15px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
