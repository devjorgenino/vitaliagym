"use client";

import React from "react";
import { PlansTable } from "../../../components/plans/PlansTable";

const Planes = () => {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-6">
      <div className="mb-4 sm:mb-6">
        <div className="relative inline-block">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Gestión de Planes
          </h1>
          <span className="absolute -top-0.5 -right-3 w-2 h-2 bg-primary rounded-full animate-pulse" />
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">
          Administra todos los planes de membresía del gimnasio
        </p>
      </div>
      <PlansTable />
    </div>
  );
};

export default Planes;
