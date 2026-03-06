"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { cn } from "@/lib/utils/cn";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md sm:p-6" onClick={onClose}>
      <div
        className={cn(
          "relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,16,31,0.98),rgba(5,10,22,0.98))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.72)] ring-1 ring-inset ring-white/[0.04] sm:p-7",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>{title ? <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2> : null}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:bg-white/5 hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}