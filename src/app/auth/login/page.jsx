"use client";

import React from "react";
import "@/styles/image-optimization.css";
import LoginComponent from "@/components/auth/Login";
import { useCriticalImagePreload } from "@/hooks/useImagePreload";

const Login = () => {
  useCriticalImagePreload();
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <LoginComponent />
    </div>
  );
};

export default Login;
