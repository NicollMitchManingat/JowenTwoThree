import React from "react";
import { render } from "@testing-library/react";
import { AnalyticsProvider } from "../context/AnalyticsContext";

export function renderWithProvider(ui) {
  return render(
    <AnalyticsProvider>
      {ui}
    </AnalyticsProvider>
  );
}