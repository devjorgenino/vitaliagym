"use client";

import React from "react";
import { PlansTable } from "../../../components/plans/PlansTable";

const Planes = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Planes</h1>
        <p className="text-muted-foreground">
          Administra todos los planes de membresía del gimnasio
        </p>
      </div>
      <PlansTable />
    </div>
  );
};

export default Planes;
