import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDefaultRoute } from "@/lib/role-access";

export default async function Home() {
  const session = await getSession();
  if (session) {
    const route = getDefaultRoute(session.role);
    redirect(route);
  } else {
    redirect("/login");
  }
}
