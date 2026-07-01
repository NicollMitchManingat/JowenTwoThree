export default function ProductCard({ product, onAddToCart }) {
  return (
    <div className="product-card" data-testid={`product-${product.id}`}>
      <div className="product-info">
        <h3 className="product-name" data-testid={`product-name-${product.id}`}>{product.name}</h3>
        <p className="product-category">{product.category}</p>
        <p className="product-price" data-testid={`product-price-${product.id}`}>₱{product.price}</p>
      </div>
      <button
        className="add-to-cart-btn"
        onClick={() => onAddToCart(product)}
        data-testid={`add-to-cart-${product.id}`}
      >
        Add to Cart
      </button>
    </div>
  )
}