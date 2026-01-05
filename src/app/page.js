"use client";

import Login from "@/components/auth/Login.jsx";
import useAuth from "@/hooks/useAuth.js";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (!loading && user) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      {loading ? <h1>Loading...</h1> : <Login />}
    </div>
  );
}
