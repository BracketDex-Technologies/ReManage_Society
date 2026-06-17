import { useMemo } from "react";
import { useTranslations } from "next-intl";
import toast, { type ToastOptions } from "react-hot-toast";

export function useTranslatedToast() {
  const t = useTranslations("common");

  return useMemo(
    () => ({
      success: (key: string, options?: ToastOptions) => toast.success(t(key), options),
      error: (key: string, options?: ToastOptions) => toast.error(t(key), options),
      loading: (key: string, options?: ToastOptions) => toast.loading(t(key), options),
    }),
    [t],
  );
}
