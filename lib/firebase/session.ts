async function updateSessionCookie(method: "POST" | "DELETE") {
  const response = await fetch("/api/auth/session", {
    method,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to sync auth session.");
  }
}

export async function setSessionCookie() {
  await updateSessionCookie("POST");
}

export async function clearSessionCookie() {
  await updateSessionCookie("DELETE");
}