// A card groups existing sellable product IDs. Cart lines always use the chosen
// SKU's ID, price and name, so checkout/recipes/refunds need no parallel cart type.
export function groupMenuProducts(products) {
  const cards = [], groups = new Map()
  for (const product of products) {
    const group = product.menuGroup
    if (!group) { cards.push(product); continue }
    if (!validGroup(group) || !validChoice(group, product.menuChoice)) throw new Error('Menu options are incomplete. Refresh the menu.')
    const key = group.key
    let card = groups.get(key)
    if (!card) {
      card = { ...product, id: `menu:${key}`, name: group.name, description: group.description || '', variants: [], menuGroup: group }
      groups.set(key, card); cards.push(card)
    } else if (JSON.stringify(card.menuGroup) !== JSON.stringify(group) || card.category !== product.category) {
      throw new Error('Menu options changed. Refresh the menu.')
    }
    if (card.variants.some(v => sameChoice(v.menuChoice, product.menuChoice))) throw new Error('Menu choices are duplicated. Refresh the menu.')
    card.variants.push(product)
    card.price = Math.min(...card.variants.map(v => v.price))
    card.hasPriceRange = card.variants.some(v => v.price !== card.price)
  }
  return cards
}

export function validGroup(group) {
  return group && typeof group.key === 'string' && /^[a-z0-9-]{1,64}$/.test(group.key) &&
    typeof group.name === 'string' && group.name.trim().length > 0 &&
    (group.description == null || typeof group.description === 'string') &&
    Array.isArray(group.options) && group.options.length <= 6 &&
    new Set(group.options.map(o => o?.key)).size === group.options.length &&
    group.options.every(o => o && typeof o.key === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(o.key) &&
      typeof o.label === 'string' && o.label.length > 0 && Array.isArray(o.choices) && o.choices.length > 0 && o.choices.length <= 20 &&
      o.choices.every(c => typeof c === 'string' && c.length > 0) && new Set(o.choices).size === o.choices.length &&
      (o.default == null || o.choices.includes(o.default)))
}

export function validChoice(group, choice) {
  return choice && typeof choice === 'object' && !Array.isArray(choice) &&
    Object.keys(choice).length === group.options.length && group.options.every(o => o.choices.includes(choice[o.key]))
}

export function sameChoice(a, b) {
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key])
}

export function selectedVariant(card, selection) {
  return card.variants?.find(v => v.recipeVerified !== false && sameChoice(v.menuChoice, selection)) || null
}
