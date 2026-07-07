import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar } from "react-chartjs-2";
import { inventoryData } from "../data/inventoryData";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

export default function StockMovementChart() {
  const data = {
    labels: inventoryData.map((item) => item.item),
    datasets: [
      {
        label: "Units Sold",
        data: inventoryData.map((item) => item.sold),
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
        data={data}
        options={options}
      />
    </div>
  );
}