"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

export default function MobileBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/dashboard");
  }, [router]);

  useEffect(() => {
    let removeListener: (() => Promise<void>) | undefined;
    let active = true;

    void import("@capacitor/app").then(({ App }) => {
      if (!active) return;

      void App.addListener("backButton", () => {
        // Keep Android's system back gesture in sync with the in-app Back button.
        if (pathname === "/" || pathname === "/dashboard") {
          void App.exitApp();
          return;
        }

        goBack();
      }).then((listener) => {
        if (active) removeListener = () => listener.remove();
        else void listener.remove();
      });
    }).catch(() => {
      // The Capacitor plugin is unavailable in a normal web browser.
    });

    return () => {
      active = false;
      void removeListener?.();
    };
  }, [goBack, pathname]);

  if (pathname === "/" || pathname === "/dashboard") {
    return null;
  }

  return (
    <div className="mb-3 lg:hidden">
      <button
        type="button"
        onClick={goBack}
        className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#FED7AA] bg-white px-3 text-sm font-semibold text-[#1C1917] shadow-sm active:scale-95 dark:border-[#303030] dark:bg-[#1E1E1E] dark:text-[#FAF7F5]"
      >
        <ArrowLeft className="h-4 w-4 text-[#F97316]" />
        Back
      </button>
    </div>
  );
}
