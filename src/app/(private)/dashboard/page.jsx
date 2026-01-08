"use client";

import React from "react";
import { DashboardView } from "../../../components/dashboard/DashboardView";

const Dashboard = () => {
  return (
    <div className="container mx-auto py-6">
      {/* <div className="mb-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vista general del gimnasio</p>
      </div> */}
      <DashboardView />
    </div>
  );
};

export default Dashboard;
