import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipeManager from '../components/settings/RecipeManager'

vi.mock('../services/db', () => ({
  db: {
    getProducts: vi.fn(),
    getInventory: vi.fn(),
    getAllRecipes: vi.fn(),
    createRecipeLine: vi.fn().mockResolvedValue({}),
    updateRecipeLine: vi.fn().mockResolvedValue({}),
    deleteRecipeLine: vi.fn().mockResolvedValue({}),
  },
}))

import { db } from '../services/db'

const PRODUCTS = [
  { id: 'p1', product_name: 'Latte' },
  { id: 'p2', product_name: 'Mocha' },
]
const INVENTORY = [
  { id: 'i1', name: 'Whole Milk', unit: 'L', stock_quantity: 8 },
  { id: 'i2', name: 'Arabica Beans (Dark)', unit: 'kg', stock_quantity: 12 },
]
const RECIPES = [
  {
    product_id: 'p1', inventory_id: 'i1', qty_per_sale: 0.2,
    products: { product_name: 'Latte' },
    inventory: { id: 'i1', name: 'Whole Milk', unit: 'L', stock_quantity: 8 },
  },
]

describe('RecipeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.getProducts.mockResolvedValue(PRODUCTS)
    db.getInventory.mockResolvedValue(INVENTORY)
    db.getAllRecipes.mockResolvedValue(RECIPES)
  })

  it('should list recipe lines for the selected product with units and stock', async () => {
    render(<RecipeManager />)

    await waitFor(() => {
      expect(screen.getByTestId('recipe-line-0')).toBeInTheDocument()
    })
    expect(screen.getByTestId('recipe-line-0')).toHaveTextContent('Whole Milk')
    expect(screen.getByTestId('recipe-line-0')).toHaveTextContent('0.2 L')
    expect(screen.getByTestId('recipe-line-0')).toHaveTextContent('8 L')
  })

  it('should flag products without recipes', async () => {
    render(<RecipeManager />)

    await waitFor(() => {
      expect(screen.getByTestId('recipe-coverage')).toBeInTheDocument()
    })
    expect(screen.getByTestId('recipe-coverage')).toHaveTextContent('Mocha')
  })

  it('should add an ingredient line with a per-sale preview', async () => {
    const user = userEvent.setup()
    render(<RecipeManager />)

    await waitFor(() => {
      expect(screen.getByTestId('recipe-add-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('recipe-add-btn'))
    await user.selectOptions(screen.getByTestId('recipe-ingredient-select'), 'i2')
    await user.type(screen.getByTestId('recipe-qty-input'), '0.02')

    expect(screen.getByTestId('recipe-preview')).toHaveTextContent(
      'Each Latte sale deducts 0.02 kg of Arabica Beans (Dark).'
    )
    await user.click(screen.getByTestId('recipe-save-btn'))

    await waitFor(() => {
      expect(db.createRecipeLine).toHaveBeenCalledWith({
        product_id: 'p1',
        inventory_id: 'i2',
        qty_per_sale: 0.02,
      })
    })
  })

  it('should surface the duplicate-ingredient error from the service', async () => {
    const user = userEvent.setup()
    db.createRecipeLine.mockRejectedValueOnce(
      new Error('That ingredient is already in this recipe — edit its quantity instead.')
    )
    render(<RecipeManager />)

    await waitFor(() => {
      expect(screen.getByTestId('recipe-add-btn')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('recipe-add-btn'))
    await user.selectOptions(screen.getByTestId('recipe-ingredient-select'), 'i1')
    await user.type(screen.getByTestId('recipe-qty-input'), '0.5')
    await user.click(screen.getByTestId('recipe-save-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('recipe-form-error')).toHaveTextContent(/already in this recipe/)
    })
  })

  it('should edit a line quantity', async () => {
    const user = userEvent.setup()
    render(<RecipeManager />)

    await waitFor(() => {
      expect(screen.getByTestId('recipe-edit-0')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('recipe-edit-0'))
    await user.clear(screen.getByTestId('recipe-qty-input'))
    await user.type(screen.getByTestId('recipe-qty-input'), '0.25')
    await user.click(screen.getByTestId('recipe-save-btn'))

    await waitFor(() => {
      expect(db.updateRecipeLine).toHaveBeenCalledWith('p1', 'i1', 0.25)
    })
  })

  it('should ask for confirmation before removing a line, and cancel cleanly', async () => {
    const user = userEvent.setup()
    render(<RecipeManager />)

    await waitFor(() => {
      expect(screen.getByTestId('recipe-delete-0')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('recipe-delete-0'))
    expect(screen.getByTestId('recipe-delete-modal')).toHaveTextContent('Whole Milk')

    await user.click(screen.getByTestId('recipe-delete-cancel'))
    expect(db.deleteRecipeLine).not.toHaveBeenCalled()
    expect(screen.queryByTestId('recipe-delete-modal')).not.toBeInTheDocument()
  })

  it('should delete only after confirmation', async () => {
    const user = userEvent.setup()
    render(<RecipeManager />)

    await waitFor(() => {
      expect(screen.getByTestId('recipe-delete-0')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('recipe-delete-0'))
    await user.click(screen.getByTestId('recipe-delete-confirm'))

    await waitFor(() => {
      expect(db.deleteRecipeLine).toHaveBeenCalledWith('p1', 'i1')
    })
  })

  it('should render lines without units when the inventory.unit column is missing', async () => {
    // Live DBs predate the inventory.unit migration — rows come back unit-less.
    db.getInventory.mockResolvedValueOnce([
      { id: 'i1', name: 'Whole Milk', stock_quantity: 8 },
      { id: 'i2', name: 'Arabica Beans (Dark)', stock_quantity: 12 },
    ])
    render(<RecipeManager />)

    await waitFor(() => {
      expect(screen.getByTestId('recipe-line-0')).toBeInTheDocument()
    })
    expect(screen.getByTestId('recipe-line-0')).toHaveTextContent('Whole Milk')
    expect(screen.getByTestId('recipe-line-0')).toHaveTextContent('0.2')
  })

  it('should show setup guidance when the recipes table is missing', async () => {
    db.getAllRecipes.mockRejectedValueOnce(
      new Error('Recipes table not set up — run frontend/product_recipes.sql in Supabase SQL Editor first.')
    )
    render(<RecipeManager />)

    await waitFor(() => {
      expect(screen.getByTestId('recipe-load-error')).toHaveTextContent(/product_recipes\.sql/)
    })
  })
})
