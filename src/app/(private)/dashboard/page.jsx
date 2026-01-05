"use client";

import { Button } from "@/components/ui/button";
import React from "react";
import client from "@/api/client";
import Image from "next/image";

const Dashboard = () => {
  return (
    <div className="flex items-center justify-center flex-col gap-6 mt-10">
      <Image src="/logo.png" alt="Logo" width={200} height={200} />
      <h1>Este es nuestro Dashboard</h1>
      <Button onClick={() => client.auth.signOut()}>Cerrar Sesión</Button>
    </div>
  );
};

export default Dashboard;
