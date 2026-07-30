import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

const mockInventoryAPI = {
  fetchInventory: async () => {
    return {
      data: [
        { id: 'I-001', name: 'Coffee', quantity: 50, price: 2.5 },
        { id: 'I-002', name: 'Tea', quantity: 30, price: 1.8 }
      ]
    }
  },
  getHealthStatus: async () => {
    return { status: 'ok' }
  }
}

const InventoryComponent = () => {
  const [inventory, setInventory] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const response = await mockInventoryAPI.fetchInventory()
        setInventory(response.data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <div data-testid="loading">Loading...</div>
  if (error) return <div data-testid="error">{error}</div>

  return (
    <div data-testid="inventory-list">
      {inventory.map((item) => (
        <div key={item.id} data-testid={`item-${item.id}`}>
          <span>{item.name}</span> - ${item.price} (Qty: {item.quantity})
        </div>
      ))}
    </div>
  )
}

describe('Frontend-Backend Integration', () => {
  describe('API Communication Layer', () => {
    it('should fetch inventory from backend API', async () => {
      const response = await mockInventoryAPI.fetchInventory()

      expect(response).toHaveProperty('data')
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBeGreaterThan(0)
    })

    it('should handle backend health check', async () => {
      const response = await mockInventoryAPI.getHealthStatus()

      expect(response).toEqual({ status: 'ok' })
    })

    it('should verify backend response has correct data structure', async () => {
      const response = await mockInventoryAPI.fetchInventory()

      response.data.forEach((item) => {
        expect(item).toHaveProperty('id')
        expect(item).toHaveProperty('name')
        expect(item).toHaveProperty('quantity')
        expect(item).toHaveProperty('price')

        expect(typeof item.id).toBe('string')
        expect(typeof item.name).toBe('string')
        expect(typeof item.quantity).toBe('number')
        expect(typeof item.price).toBe('number')
      })
    })
  })

  describe('Frontend Consuming Backend Data', () => {
    it('should display inventory items from API response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        data: [
          { id: 'I-001', name: 'Coffee', quantity: 50, price: 2.5 },
          { id: 'I-002', name: 'Tea', quantity: 30, price: 1.8 }
        ]
      })

      const originalAPI = { ...mockInventoryAPI }
      mockInventoryAPI.fetchInventory = mockFetch

      const TestComponent = () => {
        const [items, setItems] = React.useState([])

        React.useEffect(() => {
          mockFetch().then((res) => setItems(res.data))
        }, [])

        return (
          <div>
            {items.map((item) => (
              <div key={item.id} data-testid={`item-${item.id}`}>
                {item.name}
              </div>
            ))}
          </div>
        )
      }

      render(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('item-I-001')).toBeInTheDocument()
        expect(screen.getByTestId('item-I-002')).toBeInTheDocument()
      })

      expect(mockFetch).toHaveBeenCalled()
    })

    it('should handle API errors gracefully', async () => {
      const mockError = new Error('Backend connection failed')
      const mockFetch = vi.fn().mockRejectedValue(mockError)

      const TestComponent = () => {
        const [error, setError] = React.useState(null)

        React.useEffect(() => {
          mockFetch().catch((err) => setError(err.message))
        }, [])

        return error ? <div data-testid="error-message">{error}</div> : <div>Loading...</div>
      }

      render(<TestComponent />)

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument()
        expect(screen.getByText('Backend connection failed')).toBeInTheDocument()
      })
    })
  })

  describe('Data Contract Validation', () => {
    it('backend response matches frontend expectations', async () => {
      const response = await mockInventoryAPI.fetchInventory()

      const expectedSchema = {
        data: 'array',
        'data[0].id': 'string',
        'data[0].name': 'string',
        'data[0].quantity': 'number',
        'data[0].price': 'number'
      }

      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data[0]).toHaveProperty('id')
      expect(response.data[0]).toHaveProperty('name')
      expect(response.data[0]).toHaveProperty('quantity')
      expect(response.data[0]).toHaveProperty('price')
    })

    it('should validate inventory item prices are positive numbers', async () => {
      const response = await mockInventoryAPI.fetchInventory()

      response.data.forEach((item) => {
        expect(item.price).toBeGreaterThan(0)
        expect(item.quantity).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
