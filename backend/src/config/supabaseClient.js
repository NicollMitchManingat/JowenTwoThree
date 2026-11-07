// Load environment variables from .env for local development
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
// Browser keys must never be used for authenticated server commands.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Export a configured Supabase client when credentials are provided, otherwise `null`.
// Dependent code should surface a clear error if Supabase is required at runtime.
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}) : null

module.exports = {
  supabase,
}


