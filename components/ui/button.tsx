import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold tracking-tight transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-500 hover:shadow-md hover:shadow-blue-600/25 dark:bg-blue-500 dark:hover:bg-blue-400",
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
