"use client";

import { useEffect, useState } from "react";

/**
 * Animate a number from 0 to target value.
 */
export function useCountUp(
  target: number,
  duration: number = 800,
  enabled: boolean = true
): number {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setCurrent(target);
      return;
    }

    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(from + (target - from) * eased);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }, [target, duration, enabled]);

  return current;
}
