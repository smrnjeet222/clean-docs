import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import AuthForm from "@/components/AuthForm";

export default async function LoginPage() {
  const userId = await getCurrentUserId();
  if (userId) redirect("/docs");
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <AuthForm />
    </main>
  );
}
