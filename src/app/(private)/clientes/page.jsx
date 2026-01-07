"use client";

import React from "react";
import { ClientsTable } from "../../../components/clients/ClientsTable";

const Clientes = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
        <p className="text-muted-foreground">
          Administra todos los clientes del gimnasio y sus pagos
        </p>
      </div>
      <ClientsTable />
    </div>
  );
};

export default Clientes;
