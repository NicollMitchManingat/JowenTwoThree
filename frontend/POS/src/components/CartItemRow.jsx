export default function CartItemRow({ item, onRemoveItem, onUpdateQuantity }) {
  return (
    <div className="cart-item" data-testid={`cart-item-${item.id}`}>
      <div className="item-details">
        <span className="item-image"></span>
        <div className="item-info">
          <p className="item-name">{item.name}</p>
          <p className="item-unit-price">₱{item.price}</p>
        </div>
      </div>

      <div className="item-quantity-controls">
        <button
          className="qty-btn"
          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          data-testid={`decrease-qty-${item.id}`}
        >
          −
        </button>
        <span className="qty-display" data-testid={`qty-${item.id}`}>{item.quantity}</span>
        <button
          className="qty-btn"
          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          data-testid={`increase-qty-${item.id}`}
        >
          +
        </button>
      </div>

      <div className="item-total">
        <p className="item-subtotal" data-testid={`subtotal-${item.id}`}>
          ₱{item.price * item.quantity}
        </p>
        <button
          className="remove-btn"
          onClick={() => onRemoveItem(item.id)}
          data-testid={`remove-${item.id}`}
        >
          Remove
        </button>
      </div>
    </div>
  )
}