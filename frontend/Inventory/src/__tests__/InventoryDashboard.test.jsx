import React from 'react'
import { render, screen, within } from '@testing-library/react'

import App from '../App'

describe('Inventory Dashboard (Ob2W1D1)', () => {
  test('renders sidebar with navigation links', () => {
    render(<App />)
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
    const navWithin = within(nav)
    expect(navWithin.getByRole('link', { name: /Inventory/i })).toBeInTheDocument()
    expect(navWithin.getByRole('link', { name: /Orders/i })).toBeInTheDocument()
    expect(navWithin.getByRole('link', { name: /Reports/i })).toBeInTheDocument()
    expect(navWithin.getByRole('link', { name: /Settings/i })).toBeInTheDocument()
  })

  test('renders inventory table with correct headers', () => {
    render(<App />)
    const table = screen.getByRole('table', { name: /inventory-table/i })
    expect(table).toBeInTheDocument()
    expect(screen.getByText('ITEM ID')).toBeInTheDocument()
    expect(screen.getByText('NAME')).toBeInTheDocument()
    expect(screen.getByText('CATEGORY')).toBeInTheDocument()
    expect(screen.getByText('IN STOCK')).toBeInTheDocument()
    expect(screen.getByText('STATUS')).toBeInTheDocument()
  })

  test('page layout has sidebar and main', () => {
    render(<App />)
    expect(screen.getByLabelText('sidebar')).toBeInTheDocument()
    expect(screen.getByRole('main') || screen.getByText(/Inventory Dashboard/i)).toBeTruthy()
  })
})
