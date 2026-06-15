import "server-only";

export function isKeycloakEnabled(): boolean {
  // Keycloak is opt-in only. Must be explicitly enabled with a client secret.
  return (
    process.env.KEYCLOAK_ENABLED === "true" &&
    Boolean(process.env.KEYCLOAK_CLIENT_SECRET?.trim())
  );
}

export function getKeycloakUnavailableMessage(): string {
  if (process.env.NODE_ENV === "production") {
    return "Keycloak sign-in is not configured for this deployment. Use email and password.";
  }

  return "Keycloak is not running locally. Start it with: docker compose up keycloak postgres -d";
}
