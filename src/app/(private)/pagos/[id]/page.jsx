"use client";

import React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { useClients } from "@/hooks/useClients";

const NuevoPagoCliente = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const { clients, loading } = useClients();
  const clientId = params.id;

  // Leer parámetros de URL para pago restante
  const payRemaining = searchParams.get('payRemaining') === 'true';
  const remainingAmount = searchParams.get('remaining');
  const paymentId = searchParams.get('paymentId');

  // Parameters for registration mode
  const registerMode = searchParams.get('register') === 'true';
  const amountParam = searchParams.get('amount');
  const enrollmentParam = searchParams.get('enrollment');

  // Encontrar el cliente preseleccionado
  const preselectedClient = clients.find(client => client.id === clientId);

  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 pb-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-96"></div>
        </div>
      </div>
    );
  }

  if (!preselectedClient) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 pb-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Cliente no encontrado</h1>
          <p className="text-gray-600 mb-6">El cliente que buscas no existe o ha sido eliminado.</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nuevo Pago</h1>
        <p className="text-muted-foreground">
          Registrar pago para: <span className="font-semibold">{preselectedClient.first_name} {preselectedClient.last_name}</span>
        </p>
      </div>
      <PaymentsTable 
        preselectedClient={preselectedClient} 
        payRemaining={payRemaining}
        remainingAmount={remainingAmount}
        paymentId={paymentId}
        registerMode={registerMode}
        amountParam={amountParam}
        enrollmentParam={enrollmentParam}
      />
    </div>
  );
};

export default NuevoPagoCliente;