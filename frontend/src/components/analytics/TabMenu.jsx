import { useRef } from 'react';

export const ANALYTICS_GROUPS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sales', label: 'Sales' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'traffic', label: 'Customer Traffic' },
  { id: 'insights', label: 'AI Insights' },
  { id: 'reports', label: 'Reports & Sessions' },
];

export default function TabMenu({ activeTab, setActiveTab }) {
  const buttons = useRef([]);
  const onKeyDown = (event, index) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % ANALYTICS_GROUPS.length;
    else if (event.key === 'ArrowLeft') next = (index + ANALYTICS_GROUPS.length - 1) % ANALYTICS_GROUPS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ANALYTICS_GROUPS.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(ANALYTICS_GROUPS[next].id);
    buttons.current[next]?.focus();
  };

  return (
    <div data-testid="tab-menu" className="analytics-group-tabs" role="tablist" aria-label="Analytics groups">
      {ANALYTICS_GROUPS.map((tab, index) => (
        <button key={tab.id} type="button" role="tab" id={`analytics-tab-${tab.id}`} aria-controls={`analytics-panel-${tab.id}`}
          aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1}
          className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          ref={element => { buttons.current[index] = element; }} onKeyDown={event => onKeyDown(event, index)}
          onClick={() => setActiveTab(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
