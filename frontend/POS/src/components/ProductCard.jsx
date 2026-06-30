export default function ProductCard({ product, onAddToCart }) {
  return (
    <div className="product-card" data-testid={`product-${product.id}`}>
      <div className="product-info">
        <h3 className="product-name" data-testid={`product-name-${product.id}`}>{product.name}</h3>
        <p className="product-price" data-testid={`product-price-${product.id}`}>₱{product.price}</p>
      </div>
    </div>
  )
}