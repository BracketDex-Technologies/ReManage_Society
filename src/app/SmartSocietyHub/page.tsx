import { getSession } from "@/lib/auth";
import { getDefaultRoute } from "@/lib/role-access";
import SmartSocietyHubClientRedirect from "./ClientRedirect";

export const dynamic = "force-dynamic";

export default async function SmartSocietyHubRedirectPage() {
  const session = await getSession();
  const destination = session ? getDefaultRoute(session.role) : "/login";

  return <SmartSocietyHubClientRedirect destination={destination} />;
}
