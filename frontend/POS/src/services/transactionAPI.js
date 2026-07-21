const API_URL = "http://localhost:5000/api/transactions";

export async function createTransaction(transactionData) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(transactionData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to save transaction");
  }

  return await response.json();
}