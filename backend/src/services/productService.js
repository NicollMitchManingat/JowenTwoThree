const productStore = require('./productStore')

function getCategoryName(item) {
  return (
    item?.category ||
    item?.category_name ||
    item?.product_categories?.name ||
    item?.product_categories?.[0]?.name ||
    null
  )
}

function getCategoryDescription(item) {
  return (
    item?.product_categories?.description ||
    item?.product_categories?.[0]?.description ||
    null
  )
}

function getProductName(item) {
  return item?.name || item?.product_name || ''
}

function getProductSku(item) {
  return item?.sku || item?.code || ''
}

function formatProduct(p) {
  return {
    id: p?.id,
    name: getProductName(p),
    sku: getProductSku(p) || null,
    price: p?.price ?? p?.selling_price ?? p?.unit_price ?? 0,
    category: getCategoryName(p),
    image: p?.image || p?.image_url || null,
    description: p?.description || p?.product_description || getCategoryDescription(p) || null,
    created_at: p?.created_at || null,
    updated_at: p?.updated_at || null,
  }
}

async function listProducts({ q, category } = {}) {
  const keyword = typeof q === 'string' ? q.trim().toLowerCase() : ''
  const normalizedCategory = typeof category === 'string' ? category.trim() : ''

  // No fallback to mock data — a real Supabase failure should surface as an
  // error (translated to a 500 by the route layer), not a silent fake response.
  const products = await productStore.fetchProducts()

  let result = Array.isArray(products) ? products : []

  if (normalizedCategory) {
    result = result.filter((item) => getCategoryName(item) === normalizedCategory)
  }

  if (keyword) {
    result = result.filter((item) => {
      return (
        getProductName(item).toLowerCase().includes(keyword) ||
        (item.id || '').toLowerCase().includes(keyword) ||
        getProductSku(item).toLowerCase().includes(keyword)
      )
    })
  }

  return result.map(formatProduct)
}

async function getProduct(id) {
  if (!id) throw new Error('Product id is required')
  const p = await productStore.fetchProductById(id)
  return p ? formatProduct(p) : null
}

async function createProduct(payload) {
  const productName = payload?.product_name || payload?.name
  if (!payload || !productName) throw new Error('Product name is required')

  const price = typeof payload?.selling_price !== 'undefined' ? payload.selling_price : payload?.price
  const normalizedPayload = {
    product_name: productName,
    sku: payload?.sku || null,
    selling_price: typeof price === 'undefined' ? 0 : price,
    category: payload?.category || null,
    image_url: payload?.image_url || payload?.image || null,
    description: payload?.description || null,
  }

  const created = await productStore.insertProduct(normalizedPayload)
  return formatProduct(created)
}

async function updateProduct(id, payload) {
  if (!id) throw new Error('Product id is required')
  const updated = await productStore.modifyProduct(id, payload)
  return updated ? formatProduct(updated) : null
}

async function deleteProduct(id) {
  if (!id) throw new Error('Product id is required')
  const deleted = await productStore.removeProduct(id)
  return deleted ? { id: deleted.id } : null
}

module.exports = {
  formatProduct,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
}