import { useState, useMemo, useEffect } from 'react'
import { productAPI } from '../services/productAPI'
import ProductCard from './ProductCard'
import CategoryFilter from './CategoryFilter'
import '../styles/ProductPage.css'

const mockProducts = [
  {
    id: 1,
    name: "Burger",
    price: 120,
    category: "Food"
  },
  {
    id: 2,
    name: "Fries",
    price: 60,
    category: "Food"
  },
  {
    id: 3,
    name: "Coffee",
    price: 80,
    category: "Beverages"
  },
  {
    id: 8,
    name: "Iced Tea",
    price: 70,
    category: "Beverages"
  }
]

export default function ProductPage({ onAddToCart }) {
  const [products, setProducts] = useState(mockProducts)
  const [selectedCategory, setSelectedCategory] = useState("All")

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await productAPI.getAll()

        if (data && data.length > 0) {
          setProducts(data)
        }
      } catch (error) {
        console.log("Using mock products")
        setProducts(mockProducts)
      }
    }

    loadProducts()
  }, [])

  const categories = useMemo(() => {
    const unique = [
      ...new Set(
        products.map(product => product.category)
      )
    ]

    return [
      "All",
      ...unique
    ]
  }, [products])

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "All") {
      return products
    }

    return products.filter(
      product => product.category === selectedCategory
    )
  }, [selectedCategory, products])

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