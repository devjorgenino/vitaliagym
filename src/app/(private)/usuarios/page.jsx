"use client";

import React from "react";
import { UsersTable } from "../../../components/users/UsersTable";

const Usuarios = () => {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
        <p className="text-muted-foreground">
          Administra todos los usuarios registrados en el sistema
        </p>
      </div>
      <UsersTable />
    </div>
  );
};

export default Usuarios;
