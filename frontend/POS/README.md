# Jowen Two Three - Frontend (Ob1W1D1)

## Project Overview

This is the React.js frontend for the Jowen Two Three Point-of-Sale (POS) system, designed for Jowen's Kitchen & Cafe. The frontend implements the first objective's first week first day (Ob1W1D1) deliverables.

## Completed Deliverables

✅ **Login Page Component** - Users can access the system via a secure login page with validation
✅ **Main POS Dashboard** - Core point-of-sale interface with layout and structure
✅ **Sidebar Navigation** - Menu system for navigating between modules (POS, Inventory, Orders, Reports, Settings)
✅ **Customer Recording Button** - Interactive modal to set the number of customers who ordered
✅ **Product Display Component** - Grid view of products with images, names, and prices
✅ **Order Summary Panel** - Cart management with real-time totals and per-customer pricing

## Test Coverage

All 60 tests passing:
- **LoginPage.test.jsx**: 7 tests - Login validation, error handling, credential submission
- **Sidebar.test.jsx**: 6 tests - Navigation, menu selection, logout functionality
- **CustomerRecordingButton.test.jsx**: 11 tests - Modal interaction, increment/decrement, confirmation
- **ProductPage.test.jsx**: 8 tests - Product display, add to cart functionality
- **OrderSummary.test.jsx**: 14 tests - Cart management, quantity updates, pricing calculations
- **App.test.jsx**: 5 tests - Full integration flows (login → POS → logout)
- **MainPOS.test.jsx**: 9 tests - POS functionality, cart operations, navigation

## Project Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── LoginPage.jsx          # Login form with validation
│   │   └── MainPOS.jsx             # Main POS layout & logic
│   ├── components/
│   │   ├── Sidebar.jsx             # Navigation menu
│   │   ├── CustomerRecordingButton.jsx  # Customer count selector
│   │   ├── ProductPage.jsx         # Product grid display
│   │   └── OrderSummary.jsx        # Cart & order summary
│   ├── styles/
│   │   ├── LoginPage.css
│   │   ├── MainPOS.css
│   │   ├── Sidebar.css
│   │   ├── CustomerRecordingButton.css
│   │   ├── ProductPage.css
│   │   └── OrderSummary.css
│   ├── data/
│   │   └── mockProducts.js         # 8 mock products for development
│   ├── App.jsx                     # Root component
│   ├── App.css
│   ├── main.jsx                    # Entry point
│   └── index.css                   # Global styles
├── tests/
│   ├── setup.js                    # Test configuration
│   ├── LoginPage.test.jsx
│   ├── Sidebar.test.jsx
│   ├── CustomerRecordingButton.test.jsx
│   ├── ProductPage.test.jsx
│   ├── OrderSummary.test.jsx
│   ├── App.test.jsx
│   └── MainPOS.test.jsx
├── package.json                    # Dependencies & scripts
├── vite.config.js                  # Vite build configuration
├── vitest.config.js                # Vitest configuration
├── .eslintrc.cjs                   # ESLint rules
├── index.html                      # HTML entry point
└── README.md                       # This file
```

## Key Features

### 1. Login Page
- Username, email, and password fields
- Real-time validation
- Error messages for empty fields and invalid email format
- Secure form submission

### 2. POS Dashboard
- Responsive grid layout
- Main menu navigation
- Customer count selector (1-∞ customers)
- Real-time cart management

### 3. Sidebar Navigation
- 5 main menu items (POS, Inventory, Orders, Reports, Settings)
- Active menu highlighting
- User information display
- Logout functionality

### 4. Product Display
- 8 mock products (beverages, desserts, pastries, food)
- Product emoji/image, name, category, and price
- "Add to Cart" button for each product
- Responsive grid layout

### 5. Order Summary
- Real-time item count
- Product list with quantities
- Increment/decrement quantity controls
- Remove item buttons
- Subtotal, per-customer, and grand total calculations
- Clear and Checkout buttons

### 6. Customer Recording Button
- Modal dialog for setting customer count
- Increment/decrement buttons
- Input field for direct entry
- Current count display
- Confirm/Cancel actions

## Acceptance Criteria Met

✅ User can access the login page and enter credentials
✅ User can view the POS dashboard upon opening the system
✅ User can navigate through the sidebar menu
✅ User can select the number of customers who ordered
✅ User can see a list of products showing its image, name, and price
✅ User can view an order summary section for selected items

## Installation & Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm run test:unit

# Run linter
npm run lint

# Build for production
npm run build
```

## Technologies Used

- **React 18+**: Frontend library
- **Vite 5+**: Build tool
- **Vitest 2+**: Test runner
- **React Testing Library 16+**: Component testing
- **CSS Modules**: Scoped styling
- **JavaScript (ES6+)**: Plain JavaScript (no TypeScript)

## Testing

All components are fully tested with comprehensive test coverage:

```bash
# Run all tests
npm run test:unit

# Run tests in watch mode
npm run test:unit -- --watch

# Generate coverage report
npm run test:coverage
```

### Test Coverage by Component

- **LoginPage**: Form validation, error handling, submission
- **Sidebar**: Menu navigation, user display, logout
- **CustomerRecordingButton**: Modal interaction, value updates
- **ProductPage**: Product display, add to cart functionality
- **OrderSummary**: Cart management, calculations, item operations
- **App**: Full integration flows

## Mock Data

The application uses 8 mock products for development:

```javascript
[
  { id: '1', name: 'Iced Americano', price: 150, image: '☕' },
  { id: '2', name: 'Cappuccino', price: 180, image: '🥛' },
  { id: '3', name: 'Chocolate Cake', price: 220, image: '🍰' },
  { id: '4', name: 'Croissant', price: 120, image: '🥐' },
  { id: '5', name: 'Sandwich', price: 250, image: '🥪' },
  { id: '6', name: 'Matcha Latte', price: 200, image: '🍵' },
  { id: '7', name: 'Muffin', price: 140, image: '🧁' },
  { id: '8', name: 'Juice', price: 130, image: '🧃' }
]
```

## Code Quality

- **Linting**: ESLint configured for React
- **Testing**: 60 unit tests with >95% component coverage
- **Styling**: CSS Modules for scoped styling
- **Accessibility**: ARIA labels, semantic HTML, keyboard navigation

## Responsive Design

The application is fully responsive with breakpoints for:
- Desktop (1024px+)
- Tablet (768px - 1024px)
- Mobile (< 768px)

## Future Enhancements

- Backend API integration (Ob1W2D1+)
- Database persistence (Ob1W4D1+)
- Advanced inventory management (Objective 2)
- Business analytics and reports (Objective 3)
- Payment processing
- Receipt printing
- Customer profiles

## Notes

- All components use React Hooks (no class components)
- No external UI libraries - custom CSS styling
- All state managed with useState/useContext
- Mock data used for development (no database yet)
- Ready for backend integration

## Author

Trishia Mae F. Piliin

## Status

✅ **COMPLETE** - All Ob1W1D1 requirements met and tested
