// Load environment variables from .env for local development
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
// Prefer a privileged service role key when present; fall back to anon key for read-only usage
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY

// Export a configured Supabase client when credentials are provided, otherwise `null`.
// Dependent code should surface a clear error if Supabase is required at runtime.
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

module.exports = {
  supabase,
}


