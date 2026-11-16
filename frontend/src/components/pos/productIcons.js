import {
  Apple, Banana, Beef, Cake, CakeSlice, Candy, Citrus, Coffee, Cookie,
  Croissant, CupSoda, Dessert, Donut, Drumstick, EggFried, Fish,
  Hamburger, IceCreamBowl, Milk, Pizza, Popcorn, Salad, Sandwich, Soup,
  UtensilsCrossed, Wheat,
} from 'lucide-react'
import {
  BreadIcon, CinnamonRollIcon, FrappeIcon, FriesIcon, MuffinIcon, NachosIcon,
  NuggetsIcon, PastaIcon, QuesadillaIcon, RiceBowlIcon, TacoIcon, TartIcon, WontonIcon,
} from './menuFoodIcons'

const normalize = value => typeof value === 'string'
  ? value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-_]+/g, ' ').trim().replace(/\s+/g, ' ')
  : ''

// Category context disambiguates flavors from food types: cheesecake latte is
// coffee, shortcake in Iced Blended is a frappe, and Chicken in Sandwich is bread.
const CATEGORIES = {
  drinks: 'Drinks', beverage: 'Beverages', beverages: 'Beverages',
  'hot coffee': 'Hot Coffee', 'iced coffee': 'Iced Coffee', 'iced blended': 'Iced Blended',
  'non coffee': 'Non Coffee', meals: 'Meals', 'rice meal': 'Rice Meal', 'rice meals': 'Rice Meal',
  pasta: 'Pasta', pastas: 'Pasta', 'kids meal': 'Kids Meal', 'kids meals': 'Kids Meal',
  sandwich: 'Sandwich', sandwiches: 'Sandwich', snacks: 'Snacks', pastries: 'Pastries', desserts: 'Desserts',
}
const CATEGORY_FALLBACK = {
  Drinks: CupSoda, Beverages: CupSoda, 'Hot Coffee': Coffee, 'Iced Coffee': CupSoda,
  'Iced Blended': FrappeIcon, 'Non Coffee': CupSoda, Meals: UtensilsCrossed,
  'Rice Meal': RiceBowlIcon, Pasta: PastaIcon, 'Kids Meal': UtensilsCrossed,
  Sandwich, Snacks: UtensilsCrossed, Pastries: Wheat, Desserts: Dessert,
}
export const CATEGORY_TINTS = {
  Drinks: '#0284c7', Beverages: '#0284c7', 'Hot Coffee': '#92400e',
  'Iced Coffee': '#0284c7', 'Iced Blended': '#7c3aed', 'Non Coffee': '#0284c7',
  Meals: '#b45309', 'Rice Meal': '#b45309', Pasta: '#b45309',
  'Kids Meal': '#b45309', Sandwich: '#b45309', Snacks: '#b45309',
  Pastries: '#ea580c', Desserts: '#db2777',
}

// Match the prepared food before its ingredients. Word boundaries avoid false
// positives such as tea inside steak, or egg inside an unrelated product name.
const FOOD_RULES = [
  [/\b(nuggets?)\b/, NuggetsIcon],
  [/\b(quesadillas?)\b/, QuesadillaIcon],
  [/\b(nachos?)\b/, NachosIcon],
  [/\b(rangoon|wontons?)\b/, WontonIcon],
  [/\b(tacos?)\b/, TacoIcon],
  [/\b(burgers?|cheeseburgers?|hamburgers?)\b/, Hamburger],
  [/\b(sandwich(?:es)?)\b/, Sandwich],
  [/\b(pasta|spaghetti|alfredo|carbonara|bolognese|lasagn[ae]|pesto|arrabbiata)\b/, PastaIcon],
  [/\b(pizza)\b/, Pizza],
  [/\b(salad)\b/, Salad],
  [/\b(soup)\b/, Soup],
  [/\b(croissants?)\b/, Croissant],
  [/\b(muffins?)\b/, MuffinIcon],
  [/\bcinnamon rolls?\b/, CinnamonRollIcon],
  [/\b(cheesecakes?)\b/, Cake],
  [/\b(cakes?)\b/, CakeSlice],
  [/\b(tarts?|pies?)\b/, TartIcon],
  [/\b(ice cream|gelato|sundae)\b/, IceCreamBowl],
  [/\b(tiramisu|pudding)\b/, Dessert],
  [/\b(egg|bacon)\b/, EggFried],
  [/\b(bread|toast)\b/, BreadIcon],
  [/\b(donuts?|doughnuts?)\b/, Donut],
  [/\b(cookies?)\b/, Cookie],
  [/\b(fish|salmon|tuna)\b/, Fish],
  [/\b(fries|french fries)\b/, FriesIcon],
  [/\b(chicken|cordon bleu)\b/, Drumstick],
  [/\b(beef|steak)\b/, Beef],
  [/\b(stew)\b/, Soup],
  [/\b(popcorn)\b/, Popcorn],
  [/\b(candy)\b/, Candy],
]
const isBeverage = category => ['Drinks', 'Beverages', 'Hot Coffee', 'Iced Coffee', 'Iced Blended', 'Non Coffee'].includes(category)
function drinkIcon(name, category) {
  if (category === 'Iced Blended' || /\b(frappe|frappuccino|milkshake|smoothie)\b/.test(name)) return FrappeIcon
  if (category === 'Hot Coffee') return Coffee
  if (category === 'Iced Coffee' || /\b(iced|cold brew|milk tea|juice|soda|coke|sprite|royal)\b/.test(name)) return CupSoda
  if (/\bhot\b/.test(name)) return Coffee
  if (/\bmilk\b/.test(name) && !/\b(tea|latte|choco|chocolate|matcha)\b/.test(name)) return Milk
  if (category === 'Non Coffee' || category === 'Beverages') return CupSoda
  if (/\b(espresso|americano|cappuccino|latte|macchiato|mocha|mochaccino|coffee|brewed|tea|matcha|chocolate|cocoa)\b/.test(name)) return Coffee
  return CupSoda
}

// Preserve the existing rendering contract: { Icon, tint }, with size/class/ref
// controlled by the card. Unknown categories get a neutral dining fallback.
export function getProductIcon(name, category) {
  const normalized = normalize(name), key = CATEGORIES[normalize(category)]
  let Icon
  if (isBeverage(key)) Icon = drinkIcon(normalized, key)
  else if (key === 'Pasta') Icon = PastaIcon
  else if (key === 'Sandwich') Icon = Sandwich
  else {
    Icon = FOOD_RULES.find(([pattern]) => pattern.test(normalized))?.[1]
    if (!Icon && /\b(iced|cold brew|frappe|milkshake|smoothie|juice|milk|espresso|americano|cappuccino|latte|macchiato|mocha|coffee|tea|matcha|chocolate|cocoa)\b/.test(normalized)) Icon = drinkIcon(normalized, key)
    if (!Icon && /\bbanana\b/.test(normalized)) Icon = Banana
    if (!Icon && /\bapple\b/.test(normalized)) Icon = Apple
    if (!Icon && /\b(lemon|citrus|calamansi)\b/.test(normalized)) Icon = Citrus
  }
  return { Icon: Icon || CATEGORY_FALLBACK[key] || UtensilsCrossed, tint: CATEGORY_TINTS[key] }
}
