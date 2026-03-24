"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface InfoTooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom";
  maxWidth?: number;
}

export function InfoTooltip({
  text,
  children,
  position = "top",
  maxWidth = 280,
}: InfoTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: position === "top" ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: position === "top" ? 4 : -4 }}
            transition={{ duration: 0.12 }}
            className={`absolute z-50 px-3 py-2 rounded-lg bg-popover border border-border shadow-xl text-[11px] text-foreground/80 leading-relaxed pointer-events-none ${
              position === "top"
                ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
                : "top-full mt-2 left-1/2 -translate-x-1/2"
            }`}
            style={{ width: maxWidth }}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Small info icon that shows tooltip on hover */
export function InfoIcon({ text, position }: { text: string; position?: "top" | "bottom" }) {
  return (
    <InfoTooltip text={text} position={position}>
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-muted text-muted-foreground text-[8px] font-bold cursor-help hover:bg-primary/20 hover:text-primary transition-colors ml-1">
        ?
      </span>
    </InfoTooltip>
  );
}
