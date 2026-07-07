import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import ProductPage from '../components/ProductPage'
import CustomerRecordingButton from '../components/CustomerRecordingButton'
import OrderSummary from '../components/OrderSummary'
import '../styles/MainPOS.css'

export default function MainPOS({ user, onLogout }) {
  const [activeMenu, setActiveMenu] = useState('POS')
  const [customerCount, setCustomerCount] = useState(1)
  const [cart, setCart] = useState([])
  const [specialInstructions, setSpecialInstructions] = useState('')

  const handleAddToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id)

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  const handleRemoveFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId))
  }

  const handleUpdateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      handleRemoveFromCart(productId)
    } else {
      setCart(cart.map(item =>
        item.id === productId
          ? { ...item, quantity }
          : item
      ))
    }
  }

  const handleClearCart = () => {
    setCart([])
  }

  const handleCheckout = () => {
    setCart([])
    setCustomerCount(1)
    setSpecialInstructions('')
  }

  return (
    <div className="main-pos-container" data-testid="main-pos">
      <Sidebar
        activeMenu={activeMenu}
        onMenuChange={setActiveMenu}
        onLogout={onLogout}
        user={user}
      />

      <div className="pos-content">
        {activeMenu === 'POS' && (
          <div className="pos-main" data-testid="pos-main">
            <div className="pos-header">
              <h1>Point-of-Sale</h1>
              <CustomerRecordingButton
                customerCount={customerCount}
                onCustomerCountChange={setCustomerCount}
              />
            </div>

            <div className="pos-layout">
              <div className="products-section">
                <ProductPage onAddToCart={handleAddToCart} />
              </div>

              <div className="order-section">
                <OrderSummary
                  cart={cart}
                  customerCount={customerCount}
                  onRemoveItem={handleRemoveFromCart}
                  onUpdateQuantity={handleUpdateQuantity}
                  onClearCart={handleClearCart}
                  onCheckout={handleCheckout}
                  specialInstructions={specialInstructions}
                  onSpecialInstructionsChange={setSpecialInstructions}
                />
              </div>
            </div>
          </div>
        )}

        {activeMenu !== 'POS' && (
          <div className="placeholder-section">
            <h2>{activeMenu} Module</h2>
            <p></p>
          </div>
        )}
      </div>
    </div>
  )
}