# Project Instructions — Jowen Two Three

**Jowen Two Three** is an integrated Point-of-Sale, Inventory Management, and Customer Traffic Recording system with AI-based analytics for Jowen's Kitchen & Cafe.

This file is the entry point for anyone (human or AI agent) working on this codebase. Read it in full before writing or modifying any code.

---

## 1. Repository Structure

```
/
├── instructions.md          ← you are here
├── requirements/            ← source of truth for every task
│   ├── Ob1W1D1.md
│   ├── Ob1W2D1.md
│   ├── ...
│   └── Ob3W6D1.md
├── client/                  ← React frontend (created as work begins)
└── server/                  ← Express backend (created as work begins)
```

Each file in `Requirements/` follows the naming pattern:

```
Ob{objective}W{week}D{day}.md
```

- **Objective 1** = Point-of-Sale (POS)
- **Objective 2** = Inventory Management
- **Objective 3** = Business Analytic Reports

Example: `Ob2W4D2.md` = Objective 2 (Inventory), Week 4, Day 2.

---

## 2. Mandatory Workflow: Read Before You Build

**Before writing or editing any code, you must read the relevant requirement file(s) in `Requirements/` first.** Do not rely on memory of earlier turns, summaries, or assumptions about what a task involves — open and read the actual file.

For any task, follow this sequence:

1. **Identify the task** by its Objective / Week / Day (e.g., "build the inventory adjustment form" → `Ob2W2D2.md`).
2. **Open and read that file in full.** Each requirement file contains:
   - The task description and owner
   - **Sub-Tasks (Breakdown)** — the concrete pieces of work to implement
   - **Deliverable(s)** — the components/modules/endpoints expected to exist when done
   - **Test Suite / PR Acceptance Criteria** — the exact behaviors that must work for the PR to pass
3. **Check for dependencies.** Some tasks reference earlier deliverables (e.g., POS flow integration depends on the cart UI built in a prior week, analytics depends on POS and Inventory data). If the current task depends on another, read that file too before proceeding.
4. **Implement only what the file describes.** Do not add scope beyond the sub-tasks/deliverables listed. Do not skip a sub-task because it seems minor — each one maps to an acceptance criterion.
5. **Validate against the acceptance criteria** listed in the file before considering the task done. Every bullet under "Test Suite / PR Acceptance Criteria" should be either testable or manually verifiable.
6. **Write the actual tests** (see Section 4) so each acceptance criterion has a corresponding automated check wherever feasible.

If a requirement file is ambiguous or seems to conflict with another file (e.g., a shared component description differs slightly between Objective 1 and Objective 2), flag the conflict rather than guessing — pick the most conservative interpretation and note the assumption.

---

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | **React.js** (JavaScript — no TypeScript) |
| Backend | **Express.js** (Node.js — JavaScript, no TypeScript) |
| Data | **Mock data** (no real database yet) |
| Testing | **Vitest** + **React Testing Library** |

### 3.1 Frontend (React)

- Plain JavaScript (`.jsx` / `.js`) — do not introduce TypeScript or `.tsx` files.
- Functional components with hooks (no class components).
- Keep components scoped to what a single requirement file's deliverables describe — don't merge unrelated deliverables into one component.

### 3.2 Backend (Express)

- Plain JavaScript (`.js`) — do not introduce TypeScript.
- Structure routes/controllers/services so each maps cleanly to the "Deliverable(s)" named in the requirement files (e.g., a file naming a "Product Retrieval API" should produce a clearly identifiable route + controller, not be buried inside an unrelated module).

### 3.3 Data Layer — Mock Data for Now

Several requirement files describe database schemas, migrations, and persistence (e.g., `Ob1W4D2.md` "Product database schema," `Ob2W4D2.md` "Inventory database schema," `Ob1W5D1.md` "sales transaction database schema"). **For this phase, do not connect a real database.** Instead:

- Represent each described schema as an in-memory JavaScript data structure (array of objects, or a simple JSON file imported into the backend).
- Shape mock data fields to match exactly what the requirement file's schema/columns describe (e.g., Inventory rows must have `ITEM ID, NAME, CATEGORY, IN STOCK, STATUS` as described in `Ob2W1D1.md` / `Ob2W4D2.md`).
- Implement "database" operations (create, update, deduct stock, log adjustments, etc.) as functions that mutate the in-memory mock data, so the API contract behaves the same way a real database-backed implementation would.
- Keep mock data and the functions that operate on it isolated (e.g., a `mockData/` or `data/` folder per resource) so a real database can later be swapped in behind the same function signatures without changing route/controller code.
- Seed enough mock records to exercise edge cases mentioned in acceptance criteria (e.g., at least one low-stock item to trigger alerts, at least one out-of-stock item, multiple transactions across different times of day for traffic analytics).

---

## 4. Testing Setup

Install the testing dependencies with:

```bash
npm install vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom --save-dev
```

Guidelines:

- Frontend component tests use **Vitest** as the runner and **React Testing Library** for rendering/interaction (`render`, `screen`, `userEvent`), with `jsdom` as the test environment.
- Use `@testing-library/jest-dom` matchers (e.g., `toBeInTheDocument`, `toHaveTextContent`) for assertions.
- Configure Vitest's `environment` as `jsdom` for any test file touching the DOM (component tests); plain logic/service tests (e.g., calculation engine, threshold checking) can run in the default `node` environment.
- Name test files `*.test.js` (or `*.test.jsx` for component tests) alongside the code they test, or in a parallel `__tests__/` folder.
- **Every "Test Suite / PR Acceptance Criteria" bullet in a requirement file should be traceable to at least one test.** Where a criterion can't be automated (e.g., purely visual layout), note it as a manual check in the PR description instead of skipping it silently.

---

## 5. Task Execution Checklist

For every task you pick up:

- [ ] Read the matching `Requirements/ObXWYDZ.md` file in full
- [ ] Read any dependent requirement files it relies on
- [ ] Confirm tech stack constraints (JS only, mock data only) before scaffolding new code
- [ ] Implement only the listed sub-tasks and deliverables
- [ ] Write Vitest/RTL tests covering the acceptance criteria
- [ ] Run the test suite and confirm it passes
- [ ] Note any criteria that couldn't be automated, and why

---

## 6. Naming Conventions Recap

- Requirement files: `Ob{objective}W{week}D{day}.md`
- Objectives: `1` = POS, `2` = Inventory, `3` = Analytics
- Keep component, route, and service names close to the deliverable names used in the requirement files so it's easy to trace code back to the spec that justified it.
