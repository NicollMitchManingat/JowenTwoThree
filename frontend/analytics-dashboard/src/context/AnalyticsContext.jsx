import React, { createContext, useState } from "react";

export const AnalyticsContext = createContext(null);

export function AnalyticsProvider({ children }) {
  const [dateFilter, setDateFilter] = useState("Today");

  return (
    <AnalyticsContext.Provider value={{ dateFilter, setDateFilter }}>
      {children}
    </AnalyticsContext.Provider>
  );
}