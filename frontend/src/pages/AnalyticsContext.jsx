import React, { createContext, useState } from "react";

export const GRANULARITIES = ["hourly", "daily", "weekly"];

export const AnalyticsContext = createContext({
  dateFilter: "Today",
  setDateFilter: () => {},
  granularity: "daily",
  setGranularity: () => {},
});

export function AnalyticsProvider({ children }) {
  const [dateFilter, setDateFilter] = useState("Today");
  const [granularity, setGranularity] = useState("daily");

  return (
    <AnalyticsContext.Provider value={{ dateFilter, setDateFilter, granularity, setGranularity }}>
      {children}
    </AnalyticsContext.Provider>
  );
}