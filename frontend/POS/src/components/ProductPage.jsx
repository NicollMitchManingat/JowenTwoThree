import { mockProducts } from '../data/mockProducts'
import '../styles/ProductPage.css'

export default function ProductPage({ onAddToCart }) {
  return (
    <div className="product-page" data-testid="product-page">
      <h2>Products</h2>
      <div className="products-grid" data-testid="products-grid">
        {mockProducts.map(product => (
          <div key={product.id} className="product-card" data-testid={`product-${product.id}`}>
            <div className="product-info">
              <h3 className="product-name" data-testid={`product-name-${product.id}`}>{product.name}</h3>
              <p className="product-price" data-testid={`product-price-${product.id}`}>₱{product.price}</p>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  )
}
