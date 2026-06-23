import React from "react";
import Dashboard from "./components/Dashboard";
import { AnalyticsProvider } from "./context/AnalyticsContext";

export default function App() {
  return (
    <AnalyticsProvider>
      <Dashboard />
    </AnalyticsProvider>
  );
}