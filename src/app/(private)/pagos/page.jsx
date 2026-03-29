"use client";

import React from "react";
import { PaymentsTable } from "../../../components/payments/PaymentsTable";

const Pagos = () => {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Pagos</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Administra todos los pagos de clientes realizados en el gimnasio
        </p>
      </div>
      <PaymentsTable />
    </div>
  );
};

export default Pagos;
