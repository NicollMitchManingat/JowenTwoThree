import { db } from './db'

export const productAPI = {
  getAll: async () => {
    return db.getProducts()
  },

  // Direct Supabase insert (consistent with all other writes).
  // Accepts { product_name, selling_price, category } where category is a
  // product_categories name, or { product_name, selling_price, category_id }.
  createProduct: async (payload) => {
    const product_name = (payload?.product_name || payload?.name || '').trim()
    if (!product_name) throw new Error('Product name is required')

    const priceRaw = payload?.selling_price ?? payload?.price
    const selling_price = Number(priceRaw)
    if (!Number.isFinite(selling_price) || selling_price < 0) {
      throw new Error('Price must be a number >= 0')
    }

    let category_id = payload?.category_id || null
    if (!category_id) {
      const categoryName = (payload?.category || '').trim()
      if (!categoryName) throw new Error('Category is required')
      const cats = await db.getCategories()
      const match = (cats || []).find((c) => c.name === categoryName)
      if (!match) throw new Error(`Unknown category: ${categoryName}`)
      category_id = match.id
    }

    return db.createProduct({ product_name, selling_price, category_id })
  }
}
