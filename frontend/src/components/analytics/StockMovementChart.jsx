import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

export default function StockMovementChart({ data }) {
  // Default sample data if none provided
  const chartData = data && data.length > 0
    ? {
        labels: data.map((item) => item.item || item.name),
        datasets: [
          {
            label: "Units Sold",
            data: data.map((item) => item.sold || item.stock_quantity || 0),
            backgroundColor: "#3b82f6",
          },
        ],
      }
    : {
        labels: ["Espresso", "Latte", "Cappuccino", "Americano", "Mocha"],
        datasets: [
          {
            label: "Units Sold",
            data: [45, 38, 32, 28, 22],
            backgroundColor: "#3b82f6",
          },
        ],
      };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        enabled: true,
      },
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { maxTicksLimit: 5 },
      },
    },
  };

  return (
    <div data-testid="stock-chart" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h4 style={{ margin: '0 0 16px 0', paddingTop: '4px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>Stock Movement & Top Selling Items</h4>
      <div style={{ flex: 1 }}>
        <Bar
          data={chartData}
          options={options}
        />
      </div>
    </div>
  );
}