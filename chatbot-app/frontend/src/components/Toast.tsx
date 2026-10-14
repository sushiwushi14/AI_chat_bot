import React from "react";
import { AlertCircle, X } from "lucide-react";

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-red-600 text-white rounded-2xl shadow-xl text-xs max-w-sm animate-fade-in">
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="flex-1 font-medium">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="p-1 hover:bg-red-700 rounded-lg transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
