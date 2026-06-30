# Project Skills & Technology Stack

## Overview
This document outlines the technical skills and libraries required for full-stack development using Express.js (Backend) and React.js (Frontend) with comprehensive testing capabilities. The project initially uses mock data with no database integration.

---

## Backend (Express.js)

### Core Technologies
- **Runtime**: Node.js (v20+ LTS)
- **Framework**: Express.js v4.18+
- **Language**: JavaScript (ES6+ modules)

### Essential Backend Skills

#### 1. API Development
- RESTful API design principles
- Route organization and middleware chaining
- Request validation and sanitization
- Error handling middleware
- Async/await patterns
- CORS configuration
- Mock data management with in-memory arrays/objects
- Data persistence simulation using JSON files or in-memory storage

#### 2. Mock Data Management
- Creating mock data factories/generators
- In-memory data stores with CRUD operations
- Data seeding scripts for development
- Array filtering, sorting, and pagination without database
- UUID generation for unique identifiers (uuid v9+)
- Faker.js v8+ for realistic mock data generation

#### 3. Authentication & Security
- JWT (jsonwebtoken v9+) implementation
- bcryptjs v2.4+ for password hashing
- Helmet.js v7+ for security headers
- express-validator v7+ for input validation
- dotenv v16+ for environment variables

#### 4. File Handling
- Multer v1.4+ for file uploads
- File validation and type checking
- In-memory or local storage for uploaded files

#### 5. Logging & Monitoring
- Morgan v1.10+ for HTTP request logging
- Winston v3+ or Pino v8+ for application logging

### Backend Project Structure
backend/
├── src/
│ ├── config/ # Configuration files
│ ├── controllers/ # Route handlers
│ ├── middleware/ # Custom middleware (auth, validation, error)
│ ├── data/ # Mock data stores and generators
│ ├── routes/ # Route definitions
│ ├── services/ # Business logic
│ ├── utils/ # Utility functions (helpers, validators)
│ └── app.js # Express app setup
├── tests/
│ ├── unit/ # Unit tests for services/utils
│ ├── integration/ # Integration tests for routes
│ └── setup.js # Test setup
├── requirements/ # Project requirements
├── package.json
└── .env

# Frontend (React.js)

## Core Technologies

- **Library**: React v18+
- **Build Tool**: Vite v5+
- **Language**: JavaScript (JSX)

## Essential Frontend Skills

### 1. React Fundamentals

- Functional components with hooks
- `useState`, `useEffect`, `useContext`, `useReducer`
- `useRef`, `useMemo`, `useCallback`
- Custom hooks for reusable logic
- Context API for state management
- Error boundaries
- Conditional rendering patterns
- List rendering with keys

### 2. State Management

- React Context + `useReducer` for complex state
- `useState` for local component state
- Custom hooks for shared logic
- Lifting state up pattern
- State colocation principle

### 3. Routing

- React Router DOM v6+
- `useNavigate`, `useParams`, `useLocation`
- Protected routes
- Nested routing with `Outlet`
- Route-based code splitting

### 4. Form Handling

- React Hook Form v7+ for form state management
- Controlled vs uncontrolled components
- Form validation patterns
- Error message display
- Form submission handling
- Loading states

### 5. API Integration

- Axios v1.6+ or Fetch API
- Custom API service layer
- Loading, error, and empty states
- Request cancellation
- Retry logic for failed requests

### 6. UI & Styling

- CSS Modules for component-scoped styles
- CSS custom properties (variables) for theming
- Responsive design with media queries
- Accessibility (ARIA labels, semantic HTML, keyboard navigation)
- Tailwind CSS v3+ (optional)

### 7. Performance Optimization

- `React.memo` for expensive components
- `useMemo` for expensive calculations
- `useCallback` for stable function references
- Code splitting with `React.lazy` and `Suspense`
- Image lazy loading

### 8. Testing

- Vitest v2+ for unit and integration testing
- React Testing Library v16+
- Mock Service Worker (MSW) for API mocking
- Component testing
- Hook testing
- User interaction testing
- Snapshot testing (when appropriate)
- Coverage reporting

## Frontend Project Structure

frontend/
├── src/
│   ├── assets/                 # Static assets (images, fonts, icons)
│   ├── components/             # Reusable UI components
│   │   ├── common/             # Shared components (Button, Input, Modal)
│   │   └── features/           # Feature-specific components
│   ├── config/                 # Application configuration
│   ├── context/                # Context providers and reducers
│   ├── hooks/                  # Custom hooks
│   ├── pages/                  # Route/page components
│   ├── routes/                 # Route definitions and guards
│   ├── services/               # API service layer
│   ├── utils/                  # Helper and utility functions
│   ├── App.jsx                 # Root component
│   └── main.jsx                # Application entry point
├── tests/
│   ├── unit/                   # Unit tests for hooks and utilities
│   ├── components/             # Component tests
│   ├── integration/            # Integration tests
│   ├── setup.js                # Test configuration
│   └── test-utils.jsx          # Custom render utilities
├── requirements/               # Project requirements
├── vite.config.js
├── package.json
└── index.html
