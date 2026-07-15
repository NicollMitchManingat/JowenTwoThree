// Supabase client abstraction.
//
// Tests should mock this module to return a fake Supabase client.
// Real runtime can later replace the placeholder with @supabase/supabase-js.

function createSupabasePlaceholder() {
  return {
    from() {
      throw new Error(
        'Supabase client not configured. Provide a real implementation or mock this module in tests.'
      )
    },
  }
}

/**
 * Returns a Supabase-like client.
 *
 * Note: This backend currently runs without @supabase/supabase-js. The
 * placeholder keeps runtime safe; tests mock this module.
 */
function getSupabase() {
  return createSupabasePlaceholder()
}

module.exports = {
  getSupabase,
}




