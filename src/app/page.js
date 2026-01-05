"use client";

import Login from "@/components/auth/Login.jsx";
import useAuth from "@/hooks/useAuth.js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (!loading && user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      {loading ? <h1>Loading...</h1> : <Login />}
    </div>
  );
}
