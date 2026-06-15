"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PromptOptions = {
  title: string;
  message?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  required?: boolean;
};

type DialogState =
  | null
  | ({ kind: "confirm"; resolve: (value: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; resolve: (value: string | null) => void } & PromptOptions);

type AppDialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [promptValue, setPromptValue] = useState("");

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ kind: "confirm", resolve, ...options });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue || "");
      setDialog({ kind: "prompt", resolve, ...options });
    });
  }, []);

  const close = (value: boolean | string | null) => {
    if (!dialog) return;
    if (dialog.kind === "confirm") {
      dialog.resolve(Boolean(value));
    } else {
      dialog.resolve(typeof value === "string" ? value : null);
    }
    setDialog(null);
    setPromptValue("");
  };

  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      {dialog && (
        <div className="modal-overlay" onClick={() => close(dialog.kind === "confirm" ? false : null)}>
          <div className="modal-content !max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary">{dialog.title}</h3>
            {dialog.message && <p className="mt-2 text-sm leading-6 text-text-secondary">{dialog.message}</p>}

            {dialog.kind === "prompt" && (
              <div className="mt-5">
                {dialog.label && <label className="label">{dialog.label}</label>}
                {dialog.multiline ? (
                  <textarea
                    className="input min-h-28"
                    value={promptValue}
                    placeholder={dialog.placeholder}
                    onChange={(e) => setPromptValue(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <input
                    className="input"
                    value={promptValue}
                    placeholder={dialog.placeholder}
                    onChange={(e) => setPromptValue(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => close(dialog.kind === "confirm" ? false : null)}
                className="btn btn-secondary"
              >
                {dialog.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (dialog.kind === "prompt") {
                    if (dialog.required && !promptValue.trim()) return;
                    close(promptValue);
                    return;
                  }
                  close(true);
                }}
                className={`btn ${dialog.kind === "confirm" && dialog.danger ? "btn-danger" : "btn-primary"}`}
                disabled={dialog.kind === "prompt" && dialog.required && !promptValue.trim()}
              >
                {dialog.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const context = useContext(AppDialogContext);
  if (!context) {
    throw new Error("useAppDialog must be used inside AppDialogProvider");
  }
  return context;
}
