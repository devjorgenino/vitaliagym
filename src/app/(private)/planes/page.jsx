"use client";

import React from "react";
import { PlansTable } from "../../../components/plans/PlansTable";

const Planes = () => {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Planes</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Administra todos los planes de membresía del gimnasio
        </p>
      </div>
      <PlansTable />
    </div>
  );
};

export default Planes;
