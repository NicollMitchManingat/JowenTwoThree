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
  const chartData = {
    labels: data.map((item) => item.item),
    datasets: [
      {
        label: "Units Sold",
        data: data.map((item) => item.sold),
        backgroundColor: "#3b82f6",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      tooltip: {
        enabled: true,
      },
      legend: {
        display: true,
      },
    },
  };

  return (
    <div data-testid="stock-chart">
      <h3>Stock Movement & Top Selling Items</h3>

      <Bar
        data={chartData}
        options={options}
      />
    </div>
  );
}