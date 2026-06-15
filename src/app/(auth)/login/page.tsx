import { Suspense } from "react";
import { isKeycloakEnabled } from "@/lib/keycloak-config";
import LoginForm from "./LoginForm";

// Read KEYCLOAK_ENABLED at request time (not baked into static HTML at build).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const keycloakEnabled = isKeycloakEnabled();

  return (
    <Suspense fallback={null}>
      <LoginForm keycloakEnabled={keycloakEnabled} />
    </Suspense>
  );
}
