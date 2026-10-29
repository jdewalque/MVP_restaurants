import { redirect } from "next/navigation";

// The dashboard lives under /dashboard so it can later be merged with the landing page.
export default function Home() {
  redirect("/dashboard");
}
