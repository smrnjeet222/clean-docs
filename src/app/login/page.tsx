import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/session";
import AuthForm from "@/components/AuthForm";

export default async function LoginPage() {
  const userId = await getCurrentUserId();
  if (userId) redirect("/docs");
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper-white p-4">
      {/* single electric-violet glow — a soft ambient cloud, never a fill or ring */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(17,0,255,0.14) 0%, rgba(17,0,255,0.05) 35%, transparent 68%)",
          filter: "blur(36px)",
        }}
      />
      <div className="relative z-10">
        <AuthForm />
      </div>
    </main>
  );
}
