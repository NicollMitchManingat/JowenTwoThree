const a = require('./accessService')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PREVIEW_KEY = /^unit-preview:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function inputFor(context, id, input, action) {
  a.requireModules(context?.user, 'inventory')
  a.requireAdmin(context?.user)
  if (!context?.tokenHash) throw a.httpError('Please sign in again.', 401)
  if (typeof id !== 'string' || !UUID.test(id)) throw a.httpError('A valid ingredient is required')
  const fields = action === 'preview' ? ['targetUnit', 'kind', 'reason'] : ['previewKey', 'previewDigest', 'operationKey']
  if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some(key => !fields.includes(key))) {
    throw a.httpError('Invalid unit-change fields')
  }
  if (action === 'preview') {
    const kind = input.kind ?? 'conversion'
    if (!['conversion', 'label_correction'].includes(kind) || !['kg', 'g', 'L', 'mL'].includes(input.targetUnit)) throw a.httpError('Choose a supported unit change')
    if (typeof input.reason !== 'string' || !input.reason.trim() || input.reason.trim().length > 1000) throw a.httpError('A reason is required (up to 1,000 characters)')
    return { action, id, targetUnit: input.targetUnit, kind, reason: input.reason.trim() }
  }
  if (typeof input.previewKey !== 'string' || !PREVIEW_KEY.test(input.previewKey) ||
    typeof input.previewDigest !== 'string' || !/^[0-9a-f]{64}$/.test(input.previewDigest) ||
    typeof input.operationKey !== 'string' || !input.operationKey.trim() || input.operationKey.length > 128 || input.operationKey.startsWith('unit-preview:')) {
    throw a.httpError('A valid preview receipt and operation key are required')
  }
  return { action, id, previewKey: input.previewKey, previewDigest: input.previewDigest, operationKey: input.operationKey }
}

function commandError(error) {
  const messages = [
    ['AUTH_REQUIRED', 401, 'Your session has expired. Please sign in again.'],
    ['FORBIDDEN', 403, 'Administrator access is required for unit changes.'],
    ['UNIT_CONVERSION_NOT_READY', 503, 'Unit conversion is not enabled. The coordinated release must be completed first.'],
    ['UNIT_SOURCE_REVIEW_REQUIRED', 409, 'Review this ingredient and its recipe units before converting. Generic units cannot be guessed.'],
    ['UNIT_CANONICAL_LABEL_REQUIRED', 409, 'Correct the unit label before converting its quantity.'],
    ['UNIT_NOT_FOUND', 404, 'Ingredient not found. Refresh the inventory list.'],
    ['UNIT_PREVIEW_NOT_FOUND', 404, 'Preview not found. Request a new unit-change preview.'],
    ['UNIT_PREVIEW_EXPIRED', 409, 'This preview expired. Request a new preview before confirming.'],
    ['UNIT_PREVIEW_CHANGED', 409, 'The ingredient or its recipes changed. Review a fresh preview.'],
    ['UNIT_RECIPE_VERSION_CONFLICT', 409, 'Recipe unit versions need review before conversion.'],
    ['CONFLICT_OPERATION_KEY', 409, 'This operation key was already used with different details.'],
    ['UNIT_INCOMPATIBLE', 400, 'These units cannot be converted or treated as equivalent labels.'],
    ['UNIT_NO_CHANGE', 400, 'The ingredient already uses this unit.'],
    ['UNIT_PRICE_RANGE', 400, 'The converted unit price exceeds the supported range.'],
    ['UNIT_VALUE_RANGE', 400, 'The conversion values are too large to process safely.'],
    ['UNIT_TOO_MANY_RECIPES', 400, 'This ingredient has too many linked recipes for one conversion.'],
    ['UNIT_INVALID_INPUT', 400, 'Invalid unit-change request.'],
  ]
  const match = messages.find(([code]) => (error.message || '').includes(code))
  if (match) return a.httpError(match[2], match[1], match[0])
  if (['55P03', '40P01', '40001'].includes(error.code)) return a.httpError('Inventory is busy. Request a fresh preview and retry.', 409, 'UNIT_BUSY')
  return a.httpError('Unit-change service is unavailable or its database setup is incomplete.', 503, 'UNIT_SERVICE_UNAVAILABLE')
}

async function execute(context, id, input, action) {
  const data = inputFor(context, id, input, action)
  const result = await a.database().rpc('jowen_inventory_unit_change', { p_session_hash: context.tokenHash, p_data: data })
  if (result.error) throw commandError(result.error)
  // Exact decimal strings come from PostgreSQL. Never coerce preview/audit values
  // through Number or use the rounded inventory list as conversion input.
  return result.data
}

module.exports = {
  preview: (context, id, input) => execute(context, id, input, 'preview'),
  confirm: (context, id, input) => execute(context, id, input, 'confirm'),
}
