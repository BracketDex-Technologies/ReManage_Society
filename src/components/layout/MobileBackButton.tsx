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

  const goHome = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  useEffect(() => {
    let removeListener: (() => Promise<void>) | undefined;
    let active = true;

    void import("@capacitor/app").then(({ App }) => {
      if (!active) return;

      void App.addListener("backButton", () => {
        // Android's system-back gesture always returns an in-app user to Home.
        // At Home, leaving the handler empty prevents Capacitor from closing the app.
        if (pathname === "/" || pathname === "/dashboard") {
          return;
        }

        goHome();
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
  }, [goHome, pathname]);

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
