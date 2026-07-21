let supabaseClientGetter = () => require('./supabaseClient').getSupabase()

function __setSupabaseClient(getterFn) {
  // getterFn must return a Supabase-like client with `.from()`.
  supabaseClientGetter = getterFn
}

async function getAllInventory() {
  const supabase = supabaseClientGetter()

  const { data, error } = await supabase.from('inventory').select('*')

  if (error) {
    const err = new Error(error.message || 'Failed to fetch inventory')
    err.statusCode = error.statusCode || 500
    throw err
  }

  return data
}

async function getInventoryById(id) {
  const supabase = supabaseClientGetter()

  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    const err = new Error(error.message || 'Failed to fetch inventory item')
    err.statusCode = error.statusCode || 500
    throw err
  }

  return data
}

module.exports = {
  getAllInventory,
  getInventoryById,
  __setSupabaseClient,
}

