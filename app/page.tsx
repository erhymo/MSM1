import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "@/lib/config/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has(AUTH_COOKIE_NAME);

  redirect(hasSession ? "/dashboard" : "/login");
}