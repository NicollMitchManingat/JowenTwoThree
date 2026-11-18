import { describe, it, expect } from 'vitest'

import { formatProduct } from '../../src/services/productService.js'
import { createRequire } from 'node:module'
const nodeRequire = createRequire(import.meta.url)
const access = nodeRequire('../../src/services/accessService.js')
const checkout = nodeRequire('../../src/services/checkoutService.js')
const menu = nodeRequire('../../src/services/menuConfigurationService.js')

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

describe('menu configuration checkout', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  const input = { orderKey: 'test-menu-order', cart: [{ productId: id, qty: 1, price: 250, name: 'Tampered name', menu_choice: { portion: '4 pcs' } }] }
  async function withProduct(product, run) {
    const database = access.database
    access.database = () => ({ from: () => ({ select: () => ({ in: async () => ({ data: [product] }) }) }) })
    try { return await run() } finally { access.database = database }
  }
  it('uses the selected SKU name/price and ignores client option labels', async () => {
    const product = { id, product_name: 'Wings (6 pcs, Buffalo)', selling_price: 250, status: 'ACTIVE', menu_group: { key: 'wings' }, recipe_verified_at: '2026-11-17T00:00:00Z' }
    const result = await withProduct(product, () => checkout.quoteOrder({ id: 'admin', role: 'admin' }, input))
    expect(result.quote.cart[0]).toMatchObject({ productId: id, name: 'Wings (6 pcs, Buffalo)', price: 250 })
    expect(result.quote.cart[0]).not.toHaveProperty('menu_choice')
  })
  it('rejects an unverified configuration and a tampered option price', async () => {
    const product = { id, product_name: 'Wings (6 pcs, Buffalo)', selling_price: 250, status: 'ACTIVE', menu_group: { key: 'wings' }, recipe_verified_at: null }
    await expect(withProduct(product, () => checkout.quoteOrder({ role: 'admin' }, input))).rejects.toMatchObject({ statusCode: 409 })
    product.recipe_verified_at = '2026-11-17T00:00:00Z'
    await expect(withProduct(product, () => checkout.quoteOrder({ role: 'admin' }, { ...input, cart: [{ ...input.cart[0], price: 180 }] }))).rejects.toThrow(/price changed/)
  })
  it('retains legacy product compatibility and gives a useful database review error', async () => {
    const result = await withProduct({ id, product_name: 'Existing product', selling_price: 250, status: 'ACTIVE' }, () => checkout.quoteOrder({ role: 'admin' }, input))
    expect(result.quote.total).toBe(250)
    expect(checkout.rpcError({ message: 'CONFLICT_RECIPE_UNVERIFIED' })).toMatchObject({ statusCode: 409, message: expect.stringContaining('awaiting verification') })
  })
  it('blocks ordinary product edits from approving recipes or moving one option to another category', async () => {
    for (const field of ['menu_group', 'menu_choice', 'recipe_verified_at', 'recipe_verified_by_user_id']) {
      await expect(menu.guardProductUpdate(null, id, { [field]: null })).rejects.toMatchObject({ statusCode: 409 })
    }
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id, category_id: 'old', menu_group: { key: 'wings' } } }) }) }) }) }
    await expect(menu.guardProductUpdate(client, id, { category_id: 'new' })).rejects.toMatchObject({ statusCode: 409 })
    await expect(menu.guardProductUpdate(client, id, { category_id: 'old' })).resolves.toBeUndefined()
    await expect(menu.guardProductUpdate(null, id, { selling_price: 250 })).resolves.toBeUndefined()
  })
})
