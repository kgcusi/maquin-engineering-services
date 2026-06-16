import { redirect } from "next/navigation";

// Entry point: hand off to the dashboard, which the (app) layout gates behind
// authentication (unauthenticated → /login).
export default function RootPage() {
  redirect("/dashboard");
}
