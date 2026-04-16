import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border shadow-2xl flex flex-col"
        style={{ backgroundColor: "var(--bg-sidebar)", borderColor: "var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--border-color)" }}
        >
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: "var(--text-secondary)" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
