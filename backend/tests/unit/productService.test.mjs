import { describe, it, expect } from 'vitest'

import { formatProduct } from '../../src/services/productService.js'

describe('productService formatting', () => {
  it('maps Supabase product rows into the catalog format', () => {
    const fakeRow = {
      id: 'prod-1',
      product_name: 'Latte',
      selling_price: 120,
      image_url: 'https://example.com/latte.png',
      category_id: 'cat-1',
      product_categories: { name: 'Beverages' },
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    }

    const product = formatProduct(fakeRow)

    expect(product).toMatchObject({
      id: 'prod-1',
      name: 'Latte',
      price: 120,
      category: 'Beverages',
      image: 'https://example.com/latte.png',
    })
  })
})
