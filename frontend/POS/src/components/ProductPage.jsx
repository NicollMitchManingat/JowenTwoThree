function ProductPage() {
  const products = [
    {
      id: 1,
      name: "Burger",
      price: 120,
      image: "https://via.placeholder.com/150",
    },
    {
      id: 2,
      name: "Pizza",
      price: 250,
      image: "https://via.placeholder.com/150",
    },
    {
      id: 3,
      name: "Fries",
      price: 80,
      image: "https://via.placeholder.com/150",
    },
  ];

  return (
    <div className="product-page">
      <h2>Products</h2>

      <div className="product-list">
        {products.map((product) => (
          <div
            key={product.id}
            data-testid="product-card"
            className="product-card"
          >
            <img
              src={product.image}
              alt={product.name}
              width="150"
              height="150"
            />

            <h3>{product.name}</h3>

            <p>₱{product.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProductPage;