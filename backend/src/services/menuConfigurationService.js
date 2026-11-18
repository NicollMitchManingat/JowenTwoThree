const a = require('./accessService')
const CONTROLLED_FIELDS = ['menu_group', 'menu_choice', 'recipe_verified_at', 'recipe_verified_by_user_id']

async function guardProductUpdate(client, id, values) {
  if (CONTROLLED_FIELDS.some(field => Object.hasOwn(values, field))) {
    throw a.httpError('Menu options and recipe verification require the reviewed menu maintenance process.', 409)
  }
  if (!id || !Object.hasOwn(values, 'category_id')) return
  const result = await client.from('products').select('*').eq('id', id).maybeSingle()
  const current = a.check(result)
  if (current?.menu_group && current.category_id !== values.category_id) {
    throw a.httpError('A menu configuration shares its category with the other options. Change the complete menu group together.', 409)
  }
}
module.exports = { guardProductUpdate }
