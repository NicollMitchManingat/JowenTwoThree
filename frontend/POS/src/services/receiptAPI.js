const API_URL = "http://localhost:5000/api/transactions";

export async function getReceipt(id) {
  const response = await fetch(`${API_URL}/${id}/receipt`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to generate receipt");
  }

  return data.receipt;
}