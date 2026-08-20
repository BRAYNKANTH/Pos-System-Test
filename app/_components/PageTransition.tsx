"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * PageTransition
 * Wraps every page in a fade + slide-up animation.
 * Re-triggers whenever the pathname changes.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<"enter" | "exit">("enter");
  const firstRender = useRef(true);

  useEffect(() => {
    // Skip animation on the very first render (initial page load already has
    // the layout slide-in).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    // 1. Trigger exit fade-out on the old children.
    setTransitionStage("exit");

    // 2. After the exit animation (80ms), swap children and animate in.
    const t = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionStage("enter");
    }, 80);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Keep children in sync when they update on the same route (data
  // refresh). `children` is a new element tree essentially every render,
  // so there's no stable "previous value" to branch on outside an effect
  // the way a simple prop does — this really is synchronizing internal
  // display state to an external (parent-driven) stream of updates.
  useEffect(() => {
    if (transitionStage === "enter") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above the effect
      setDisplayChildren(children);
    }
  }, [children, transitionStage]);

  return (
    <div
      className={
        transitionStage === "enter"
          ? "animate-page-enter"
          : "animate-page-exit"
      }
    >
      {displayChildren}
    </div>
  );
}
