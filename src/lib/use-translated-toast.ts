import { useI18n } from "@/lib/i18n";
import toast, { type ToastOptions } from "react-hot-toast";

export function useTranslatedToast() {
  const { t } = useI18n();

  return {
    success: (key: string, options?: ToastOptions) => toast.success(t(key), options),
    error: (key: string, options?: ToastOptions) => toast.error(t(key), options),
    loading: (key: string, options?: ToastOptions) => toast.loading(t(key), options),
  };
}
