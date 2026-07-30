"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

interface CenterMorphModalProps {
  open: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  onClose: () => void;
}

export function CenterMorphModal({
  open,
  title,
  description,
  actionLabel = "Got it",
  onClose,
}: CenterMorphModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-white p-7 text-center shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
            initial={{ borderRadius: 999, opacity: 0, scale: 0.2 }}
            animate={{ borderRadius: 32, opacity: 1, scale: 1 }}
            exit={{ borderRadius: 999, opacity: 0, scale: 0.2 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-text-secondary transition-colors hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>

            <motion.div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"
              initial={{ scale: 0.5, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.08, duration: 0.28 }}
            >
              <CheckCircle2 className="h-8 w-8" />
            </motion.div>

            <h2 className="text-xl font-black text-text-primary">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{description}</p>

            <button type="button" onClick={onClose} className="btn btn-primary mt-6 w-full">
              {actionLabel}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
