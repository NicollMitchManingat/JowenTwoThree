import { mockProducts } from '../data/mockProducts'
import ProductCard from './ProductCard'
import '../styles/ProductPage.css'

export default function ProductPage({ onAddToCart }) {
  return (
    <div className="product-page" data-testid="product-page">
      <h2>Products</h2>
      <div className="products-grid" data-testid="products-grid">
        {mockProducts.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </div>
  )
}