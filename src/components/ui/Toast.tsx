"use client";

import "@/styles/toast.css";
import { Toaster } from "react-hot-toast";
export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#111827",
          color: "#fff",
          fontSize: "0.875rem",
          borderRadius: "0.5rem",
          padding: "0.75rem 1rem",
        },
        success: {
          iconTheme: {
            primary: "#22c55e",
            secondary: "#fff",
          },
        },
        error: {
          iconTheme: {
            primary: "#ef4444",
            secondary: "#fff",
          },
        },
      }}
    />
  );
}
