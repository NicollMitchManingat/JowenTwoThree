import React from "react";

export default function TabMenu({ activeTab, setActiveTab }) {
  const tabs = ["Sales", "Inventory", "Customers"];

  return (
    <div data-testid="tab-menu">
      {tabs.map((tab) => (
        <button key={tab} onClick={() => setActiveTab(tab)}>
          {tab}
        </button>
      ))}
    </div>
  );
}