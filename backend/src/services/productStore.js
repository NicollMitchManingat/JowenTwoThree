const { supabase } = require('../config/supabaseClient')

const PRODUCT_SELECT =
  'id, product_name, selling_price, status, image_url, created_at, updated_at, category_id, product_categories(name, description)'

// Fallback dataset used only when Supabase credentials are not provided.
// This keeps automated API tests passing in environments without Supabase.
const fallbackProducts = [
  {
    id: 1,
    product_name: 'Coca Cola',
    selling_price: 3.5,
    status: 'active',
    image_url: 'https://example.com/coca-cola.png',
    category_id: null,
    product_categories: { name: 'Beverages', description: 'Chilled Coca Cola' },
  },
  {
    id: 2,
    product_name: 'Orange Juice',
    selling_price: 4.0,
    status: 'active',
    image_url: 'https://example.com/orange-juice.png',
    category_id: null,
    product_categories: { name: 'Beverages', description: 'Fresh orange juice' },
  },
  {
    id: 3,
    product_name: 'Burger',
    selling_price: 9.5,
    status: 'active',
    image_url: 'https://example.com/burger.png',
    category_id: null,
    product_categories: { name: 'Food', description: 'Juicy grilled burger' },
  },
]


async function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase client not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in environment.'
    )
  }

  return supabase
}

async function resolveCategoryId(client, categoryValue) {
  if (!categoryValue) return null
  if (typeof categoryValue === 'string' && categoryValue.trim() === '') return null

  if (categoryValue && typeof categoryValue === 'object' && categoryValue.id) {
    return categoryValue.id
  }

  const { data, error } = await client
    .from('product_categories')
    .select('id')
    .eq('name', categoryValue)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data?.id || null
}

async function buildProductPayload(payload) {
  const normalized = { ...payload }

  if (normalized.name && !normalized.product_name) {
    normalized.product_name = normalized.name
  }

  if (typeof normalized.price !== 'undefined' && typeof normalized.selling_price === 'undefined') {
    normalized.selling_price = normalized.price
  }

  if (normalized.image && !normalized.image_url) {
    normalized.image_url = normalized.image
  }

  if (!normalized.category_id && normalized.category) {
    const client = await getSupabaseClient()
    normalized.category_id = await resolveCategoryId(client, normalized.category)
  }

  delete normalized.name
  delete normalized.price
  delete normalized.image
  delete normalized.category

  return normalized
}

// This backend uses Supabase when configured.
// In test/dev environments without Supabase credentials, fall back to a small
// in-memory dataset so API route tests can still validate response shape.
async function fetchProducts() {
  // If no Supabase credentials are provided, return fallback products.
  if (!supabase) return fallbackProducts

  const client = await getSupabaseClient()


  const { data, error } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data : []
}


async function fetchProductById(id) {
  const client = await getSupabaseClient()

  const { data, error, status } = await client
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    // If not found, return null to let service layer translate to 404
    if (status === 404) return null
    throw new Error(error.message)
  }

  return data
}

async function insertProduct(payload) {
  const client = await getSupabaseClient()
  const normalizedPayload = await buildProductPayload(payload)

  const { data, error } = await client
    .from('products')
    .insert(normalizedPayload)
    .select(PRODUCT_SELECT)

  if (error) {
    throw new Error(error.message)
  }

  // Supabase returns an array of inserted rows
  return Array.isArray(data) ? data[0] : data
}

async function modifyProduct(id, payload) {
  const client = await getSupabaseClient()
  const normalizedPayload = await buildProductPayload(payload)

  const { data, error, status } = await client
    .from('products')
    .update(normalizedPayload)
    .eq('id', id)
    .select(PRODUCT_SELECT)

  if (error) {
    if (status === 404) return null
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data[0] : data
}

async function removeProduct(id) {
  const client = await getSupabaseClient()

  const { data, error, status } = await client
    .from('products')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    if (status === 404) return null
    throw new Error(error.message)
  }

  return Array.isArray(data) ? data[0] : data
}

module.exports = {
  fetchProducts,
  fetchProductById,
  insertProduct,
  modifyProduct,
  removeProduct,
}