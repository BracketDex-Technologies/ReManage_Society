import { Suspense } from "react";
import AuthCompletePage from "./AuthCompleteClient";

export default function AuthCompleteRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <div className="spinner !w-8 !h-8" />
        </div>
      }
    >
      <AuthCompletePage />
    </Suspense>
  );
}
