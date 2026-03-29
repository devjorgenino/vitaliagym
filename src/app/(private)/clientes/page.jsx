"use client";

import React from "react";
import { ClientsTable } from "../../../components/clients/ClientsTable";

const Clientes = () => {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Clientes</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Administra todos los clientes del gimnasio y sus pagos
        </p>
      </div>
      <ClientsTable />
    </div>
  );
};

export default Clientes;
