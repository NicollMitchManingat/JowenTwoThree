let supabaseClientGetter = () => require('./supabaseClient').getSupabase()

function __setSupabaseClient(getterFn) {
  // getterFn must return a Supabase-like client with `.from()`.
  supabaseClientGetter = getterFn
}

async function getAllAlerts() {
  const supabase = supabaseClientGetter()

  const { data, error } = await supabase.from('alerts').select('*')

  if (error) {
    const err = new Error(error.message || 'Failed to fetch alerts')
    err.statusCode = error.statusCode || 500
    throw err
  }

  return data
}

async function getAlertById(id) {
  const supabase = supabaseClientGetter()

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    const err = new Error(error.message || 'Failed to fetch alert')
    err.statusCode = error.statusCode || 500
    throw err
  }

  return data
}

module.exports = {
  getAllAlerts,
  getAlertById,
  __setSupabaseClient,
}

