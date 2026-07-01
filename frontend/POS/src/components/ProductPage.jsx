import { useState, useMemo } from 'react'
import { mockProducts } from '../data/mockProducts'
import ProductCard from './ProductCard'
import CategoryFilter from './CategoryFilter'
import '../styles/ProductPage.css'

export default function ProductPage({ onAddToCart }) {
  const [selectedCategory, setSelectedCategory] = useState('All')

  const categories = useMemo(() => {
    const unique = [...new Set(mockProducts.map(product => product.category))]
    return ['All', ...unique]
  }, [])

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') return mockProducts
    return mockProducts.filter(product => product.category === selectedCategory)
  }, [selectedCategory])

  return (
    <div className="product-page" data-testid="product-page">
      <h2>Products</h2>

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <div className="products-grid" data-testid="products-grid">
        {filteredProducts.map(product => (
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