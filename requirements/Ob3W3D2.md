# Jowen Two Three: An Integrated Point of Sale, Inventory Management, and Customer Traffic Recording System with AI-Based Analytics for Jowen's Kitchen & Cafe

## Objective 3: Business Analytic Reports

**Owner:** Nicoll Mitch E. Maningat

**Week:** 3 | **Day:** 2

## Task: Establish the Data Aggregation Core and Database Views (Back-End)

### Sub-Tasks (Breakdown)
- Define analytical database views that securely join historical records from both the POS and Inventory tables.
- Develop the master data extraction AIS (merged route/controller) to retrieve these combined datasets.

### Deliverable(s)
- Read-only analytical database views.
- Master data extraction AIS endpoint.

### Test Suite / PR Acceptance Criteria
- Database views accurately execute cross-table joins without duplicating POS or Inventory records.
- Extraction AIS responds with an HTTP 200 status and a properly formatted JSON payload in API testing tools.

### Instructor Notes

_[Space reserved for instructor feedback]_
