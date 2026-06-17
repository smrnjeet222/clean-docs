"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="text-[14px] font-medium text-ink-violet underline decoration-1 underline-offset-2 hover:text-electric-violet"
    >
      Sign out
    </button>
  );
}
