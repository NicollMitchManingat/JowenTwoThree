# Copilot Instructions for Jowen Two Three

## Project Overview

**Jowen Two Three** is an integrated Point-of-Sale (POS), Inventory Management, and Customer Traffic Recording system with AI-based analytics for Jowen's Kitchen & Cafe.

Built as a full-stack JavaScript monorepo with two independently deployable packages:
- **Backend**: Express.js REST API (Node.js v20+ LTS)
- **Frontend**: React.js web application (React v18+)

The project uses mock data exclusively (no database integration yet) and requires comprehensive test coverage with Vitest + React Testing Library.

---

## Build, Test, and Lint Commands

### Backend (Express.js)

All commands run from the `backend/` directory:

```bash
# Install dependencies
npm ci

# Run linter (ESLint)
npm run lint

# Run all unit tests
npm run test:unit

# Run tests in watch mode
npm run test:unit -- --watch
```

### Frontend (React.js)

All commands run from the `frontend/` directory:

```bash
# Install dependencies
npm ci

# Run linter (ESLint)
npm run lint

# Run all unit tests with coverage
npm run test:unit -- --coverage

# Run tests in watch mode
npm run test:unit -- --watch
```

### CI/CD Pipeline

The GitHub Actions workflows run on every push and PR to main:
- **Backend Tests**: Linting and unit tests
- **Frontend Tests**: Linting and unit tests with coverage
- Coverage reports are uploaded as artifacts

---

## Architecture & Technology Stack

### Backend Skills (Express.js)

#### Core Technologies
- **Runtime**: Node.js v20+ LTS
- **Framework**: Express.js v4.18+
- **Language**: JavaScript (ES6+ modules)

#### Essential Backend Capabilities

**1. API Development**
- RESTful API design with proper status codes
- Route organization and middleware chaining
- Request validation and sanitization using express-validator v7+
- Error handling middleware patterns
- Async/await patterns throughout
- CORS configuration for cross-origin requests

**2. Mock Data Management** (No database integration)
- In-memory data stores with CRUD operations using arrays/objects
- Mock data factories and generators
- UUID generation (uuid v9+) for unique identifiers
- Faker.js v8+ for realistic mock data
- Data seeding scripts for development
- Array filtering, sorting, and pagination without database

**3. Authentication & Security**
- JWT (jsonwebtoken v9+) implementation for token-based auth
- bcryptjs v2.4+ for secure password hashing
- Helmet.js v7+ for HTTP security headers
- Input validation and sanitization
- Environment variable management with dotenv v16+

**4. File Handling**
- Multer v1.4+ for file upload processing
- File type validation and checking
- In-memory or local storage for uploaded files

**5. Logging & Monitoring**
- Morgan v1.10+ for HTTP request logging
- Winston v3+ or Pino v8+ for structured application logging

**6. Testing**
- Vitest v2+ as test runner
- Unit tests for all services, utilities, routes, and middleware
- Mock data for all external dependencies
- Integration tests for API endpoints
- No real API calls or database connections in tests

#### Backend Project Structure
```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/      # Route handlers (request/response logic)
│   ├── middleware/       # Custom middleware (auth, validation, error)
│   ├── data/             # Mock data stores and generators
│   ├── routes/           # Route definitions
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions (helpers, validators)
│   └── app.js            # Express app setup
├── tests/
│   ├── unit/             # Unit tests for services/utils
│   ├── integration/      # Integration tests for routes
│   └── setup.js          # Test configuration
├── requirements/         # Project requirements documentation
├── package.json
└── .env
```

---

### Frontend Skills (React.js)

#### Core Technologies
- **Library**: React v18+
- **Build Tool**: Vite v5+
- **Language**: JavaScript (JSX)
- **Testing**: Vitest v2+ + React Testing Library v16+

#### Essential Frontend Capabilities

**1. React Fundamentals**
- Functional components with hooks
- `useState`, `useEffect`, `useContext`, `useReducer` for state management
- `useRef`, `useMemo`, `useCallback` for performance optimization
- Custom hooks for reusable logic
- Context API for application state
- Error boundaries for error handling
- Conditional rendering patterns
- Proper list rendering with keys

**2. State Management**
- React Context + `useReducer` for complex state
- `useState` for local component state
- Custom hooks for shared logic
- State lifting pattern
- State colocation principle

**3. Routing**
- React Router DOM v6+
- `useNavigate`, `useParams`, `useLocation` hooks
- Protected/guarded routes
- Nested routing with `Outlet`
- Route-based code splitting with `React.lazy` and `Suspense`

**4. Form Handling**
- React Hook Form v7+ for form state management
- Controlled vs uncontrolled components pattern
- Form validation with error handling
- Loading and submission states
- Accessible form inputs with ARIA labels

**5. API Integration**
- Axios v1.6+ or Fetch API for HTTP requests
- Custom API service layer for abstraction
- Loading, error, and empty state handling
- Request cancellation for cleanup
- Retry logic for failed requests
- Mock Service Worker (MSW) for API mocking in tests

**6. UI & Styling**
- CSS Modules for component-scoped styles
- CSS custom properties (variables) for theming
- Responsive design with media queries
- Accessibility (ARIA labels, semantic HTML, keyboard navigation)
- Optional: Tailwind CSS v3+ integration

**7. Performance Optimization**
- `React.memo` for expensive components
- `useMemo` for expensive calculations
- `useCallback` for stable function references
- Code splitting with lazy loading
- Image lazy loading

**8. Testing**
- Vitest v2+ as test runner
- React Testing Library v16+ for component testing
- Mock Service Worker (MSW) for API mocking
- User interaction testing (not implementation details)
- Hook testing with custom test utilities
- Coverage reporting

#### Frontend Project Structure
```
frontend/
├── src/
│   ├── assets/                  # Static assets (images, fonts, icons)
│   ├── components/
│   │   ├── common/              # Shared components (Button, Input, Modal)
│   │   └── features/            # Feature-specific components
│   ├── config/                  # Application configuration
│   ├── context/                 # Context providers and reducers
│   ├── hooks/                   # Custom hooks
│   ├── pages/                   # Route/page components
│   ├── routes/                  # Route definitions and guards
│   ├── services/                # API service layer
│   ├── utils/                   # Helper and utility functions
│   ├── App.jsx                  # Root component
│   └── main.jsx                 # Application entry point
├── tests/
│   ├── unit/                    # Unit tests for hooks and utilities
│   ├── components/              # Component tests
│   ├── integration/             # Integration tests
│   ├── setup.js                 # Test configuration
│   └── test-utils.jsx           # Custom render utilities
├── requirements/                # Project requirements
├── vite.config.js
├── vitest.config.js
├── package.json
└── index.html
```

---

## Key Conventions

### 1. Testing is Mandatory
- **Every file requires test coverage**: components, hooks, utilities, routes, middleware, controllers, services
- Use Vitest as the test runner for both packages
- React Testing Library for component/integration testing
- Mock all external dependencies (APIs, file system, etc.)
- No real API calls or database connections in tests
- Include both happy path and error scenarios

### 2. Mock Data Only (No Database)
- The project uses mock data exclusively, no external databases
- Create mock data factories and generators in `data/` (backend) or service mocks (frontend)
- Simulate CRUD operations with in-memory arrays/objects
- For testing: mock all external calls completely

### 3. Code Quality
- **Linting**: ESLint configured for both packages; run `npm run lint` before committing
- **Testing**: All tests must pass; run `npm run test:unit` locally before pushing
- Fix linting errors immediately; use `npm run lint -- --fix` when possible

### 4. Package Management
- Use `npm ci` for reproducible, locked dependency installs (NOT `npm install`)
- Node.js version: 20 LTS (enforced in CI)
- Update `package-lock.json` when dependencies change

### 5. Development Workflow
- After pulling, run `npm ci` in both `backend/` and `frontend/` directories
- Use `npm run test:unit -- --watch` during development for immediate feedback
- Write tests first (TDD approach) when adding features
- Run linter and tests locally before creating PRs
- Verify CI passes before merging

### 6. Security & Environment
- Use `.env` for environment variables (never commit secrets)
- JWT tokens for authentication (backend)
- Password hashing with bcryptjs (backend)
- CORS configuration for frontend requests (backend)
- Helmet.js for security headers (backend)

---

## Dependency Stack Summary

### Backend
```json
{
  "express": "^4.18",
  "jsonwebtoken": "^9.0",
  "bcryptjs": "^2.4",
  "helmet": "^7.0",
  "express-validator": "^7.0",
  "multer": "^1.4",
  "morgan": "^1.10",
  "dotenv": "^16.0",
  "uuid": "^9.0",
  "faker": "^8.0",
  "vitest": "^2.0",
  "@testing-library/react": "^16.0"
}
```

### Frontend
```json
{
  "react": "^18.0",
  "react-dom": "^18.0",
  "react-router-dom": "^6.0",
  "react-hook-form": "^7.0",
  "axios": "^1.6",
  "vitest": "^2.0",
  "@testing-library/react": "^16.0",
  "@testing-library/jest-dom": "latest",
  "@testing-library/user-event": "latest",
  "msw": "latest",
  "vite": "^5.0"
}
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Install backend deps | `cd backend && npm ci` |
| Install frontend deps | `cd frontend && npm ci` |
| Run backend tests | `cd backend && npm run test:unit` |
| Run frontend tests | `cd frontend && npm run test:unit` |
| Lint backend | `cd backend && npm run lint` |
| Lint frontend | `cd frontend && npm run lint` |
| Watch backend tests | `cd backend && npm run test:unit -- --watch` |
| Watch frontend tests | `cd frontend && npm run test:unit -- --watch` |
