"use client";

import React from "react";
import { PaymentsTable } from "../../../components/payments/PaymentsTable";

const Pagos = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Pagos</h1>
        <p className="text-muted-foreground">
          Administra todos los pagos de clientes realizados en el gimnasio
        </p>
      </div>
      <PaymentsTable />
    </div>
  );
};

export default Pagos;
