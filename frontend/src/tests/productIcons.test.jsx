import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  Beef, Cake, CakeSlice, Coffee, Croissant, CupSoda, Dessert, Drumstick,
  EggFried, Fish, Hamburger, Milk, Pizza, Sandwich, UtensilsCrossed, Wheat,
} from 'lucide-react'
import { getProductIcon, CATEGORY_TINTS } from '../components/pos/productIcons'
import * as food from '../components/pos/menuFoodIcons'

// Current menu families, including names shared across different categories.
const MENU_CASES = [
  ['Hot Coffee (8 oz)', Coffee, ['Cafe Americano', 'Caramel Macchiato']],
  ['Iced Coffee (16 oz, double shot)', CupSoda, ['Americano', 'Caramel Macchiato']],
  ['Ice Blended (Frappe)', food.FrappeIcon, ['Biscoff Cookie', 'Almond Java Chip']],
  ['Non-Coffee', CupSoda, ['Strawberry Matcha', 'Choco Pistachio Latté']],
  ['Extras', food.RiceBowlIcon, ['Plain Rice', 'Garlic Rice']],
  ['Drinks', Coffee, ['Espresso', 'Latte', 'Americano', 'Cappuccino', 'Hot Chocolate']],
  ['Drinks', CupSoda, ['Iced Matcha', 'Iced Coffee', 'Milk Tea']],
  ['Hot Coffee', Coffee, ['Cafe Americano', 'Cafe Latte', 'Cappuccino', 'Caramel Macchiato', 'Mochaccino']],
  ['Iced Coffee', CupSoda, ['Americano', 'Biscoff Cheesecake Latte', 'Caramel Macchiato', 'Hazelnut', 'Matcha Espresso', 'Mocha', 'Sea Salt Pistachio', 'Spanish Latte', 'White Mocha']],
  ['Iced Blended', food.FrappeIcon, ['Almond Java Chip', 'Biscoff Coookie', 'Choco Nutella', 'Green Matcha', 'Red Velvet', 'Salted Caramel', 'Strawberry Shortcake', 'White Choco Oreo']],
  ['Non Coffee', Coffee, ['Hot Chocolate', 'Hot Match Latte']],
  ['Non Coffee', CupSoda, ['Iced Choco Latte', 'Iced Matcha Latte', 'Strawberry Latte', 'Strawberry Match', 'Ube Matcha']],
  ['Beverages', CupSoda, ['Blueberry', 'Coke', 'Coke Zero', 'Green Apple', 'House Blend Iced Tea', 'Orange Iced Tea', 'Pineapple Juice', 'Royal', 'Sprite', 'Strawberry', 'Tropical Juice']],
  ['Pasta', food.PastaIcon, ['Carbonara', 'Charlie Chan', 'Creamy Chicken Pesto ', 'Creamy Tuna Pesto ', 'Dinughetti', 'Meaty Spaghetti', 'Tuna Arrabbiata']],
  ['Kids Meal', food.PastaIcon, ['Meaty Spaghetti']],
  ['Kids Meal', food.NuggetsIcon, ['Chicken Nuggets with Fries']],
  ['Meals', Sandwich, ['Club Sandwich']],
  ['Meals', EggFried, ['Bacon & Egg Toast']],
  ['Meals', food.PastaIcon, ['Spaghetti Bolognese', 'Chicken Alfredo']],
  ['Meals', food.TacoIcon, ['Beef Tacos']],
  ['Rice Meal', Beef, ['Beef Salpicao', 'Creamy Beef with Mushroom']],
  ['Rice Meal', Drumstick, ['Cordon Bleu Parmigiana', 'Rosemary Chicken']],
  ['Rice Meal', Fish, ['Fish Fillet with Fries', 'Fish Fillet with Rice']],
  ['Rice Meal', food.RiceBowlIcon, ['Crispy Binagoongan', 'Dinakdakan', 'Longganisa Rice']],
  ['Sandwich', Sandwich, ['BBQ Pulled Pork', 'Chicken', 'Grilled Ham & Cheese']],
  ['Snacks', food.NachosIcon, ['Baked Nachos']],
  ['Snacks', food.WontonIcon, ['Crab Rangoon']],
  ['Snacks', food.FriesIcon, ['French Fries', 'Fries Overload']],
  ['Snacks', food.QuesadillaIcon, ['Quesadilla']],
  ['Pastries', Croissant, ['Croissant']],
  ['Pastries', food.MuffinIcon, ['Blueberry Muffin']],
  ['Pastries', food.BreadIcon, ['Banana Bread']],
  ['Pastries', food.CinnamonRollIcon, ['Cinnamon Roll']],
  ['Desserts', CakeSlice, ['Chocolate Cake']],
  ['Desserts', Cake, ['Strawberry Cheesecake']],
  ['Desserts', Dessert, ['Tiramisu']],
  ['Desserts', food.TartIcon, ['Lemon Tart']],
].flatMap(([category, Icon, names]) => names.map(name => [name, category, Icon]))

describe('product icon matching', () => {
  it.each(MENU_CASES)('represents %s in %s using its prepared product type', (name, category, Icon) => {
    expect(getProductIcon(name, category).Icon).toBe(Icon)
    expect(getProductIcon(name, category).tint).toBe(CATEGORY_TINTS[category])
  })
  it('keeps beverage context ahead of flavor names', () => {
    expect(getProductIcon('Biscoff Cheesecake Latte', 'Iced Coffee').Icon).toBe(CupSoda)
    expect(getProductIcon('Strawberry Shortcake', 'Iced Blended').Icon).toBe(food.FrappeIcon)
    expect(getProductIcon('Green Apple', 'Beverages').Icon).toBe(CupSoda)
    expect(getProductIcon('Hot Chocolate', 'Non Coffee').Icon).toBe(Coffee)
  })
  it('prioritizes the dish over its ingredients and incidental word fragments', () => {
    expect(getProductIcon('Chicken Sandwich', 'Meals').Icon).toBe(Sandwich)
    expect(getProductIcon('Tuna Pasta', 'Meals').Icon).toBe(food.PastaIcon)
    expect(getProductIcon('Coffee Cake', 'Desserts').Icon).toBe(CakeSlice)
    expect(getProductIcon('Steak', 'Meals').Icon).toBe(Beef)
    expect(getProductIcon('Pepperoni Pizza', 'Meals').Icon).toBe(Pizza)
    expect(getProductIcon('Cheeseburger', 'Meals').Icon).toBe(Hamburger)
  })
  it('normalizes category/name case, spacing and common category variants', () => {
    expect(getProductIcon('  CAPPUCCINO ', ' hot   coffee ').Icon).toBe(Coffee)
    expect(getProductIcon(' Cafe Latte ', 'Iced-Coffee').Icon).toBe(CupSoda)
    expect(getProductIcon('Chicken', 'Sandwiches').Icon).toBe(Sandwich)
    expect(getProductIcon('Charlie Chan', 'Pastas').Icon).toBe(food.PastaIcon)
    expect(getProductIcon('New dish', 'Rice Meals').Icon).toBe(food.RiceBowlIcon)
  })
  it('uses category fallbacks without turning unknown food into coffee', () => {
    expect(getProductIcon('New Drink', 'Drinks').Icon).toBe(CupSoda)
    expect(getProductIcon('New Pastry', 'Pastries').Icon).toBe(Wheat)
    expect(getProductIcon('New Dessert', 'Desserts').Icon).toBe(Dessert)
    expect(getProductIcon('New Meal', 'Meals').Icon).toBe(UtensilsCrossed)
    expect(getProductIcon('Mystery Item', 'Other')).toEqual({Icon:UtensilsCrossed,tint:undefined})
    expect(getProductIcon(null, 'Meals').Icon).toBe(UtensilsCrossed)
    expect(getProductIcon(undefined, undefined).Icon).toBe(UtensilsCrossed)
  })
  it('handles future generic drinks without using fruit icons for juice', () => {
    expect(getProductIcon('Fresh Milk', 'Drinks').Icon).toBe(Milk)
    expect(getProductIcon('Green Apple Juice', 'Specials').Icon).toBe(CupSoda)
    expect(getProductIcon('Cold Brew', 'Drinks').Icon).toBe(CupSoda)
    expect(getProductIcon('Strawberry Smoothie', 'Drinks').Icon).toBe(food.FrappeIcon)
  })
  it.each(Object.entries(food))('renders %s with the existing card SVG contract', (_name, Icon) => {
    const element=document.createElement('div')
    element.innerHTML=renderToStaticMarkup(<Icon size={32} className="product-icon" style={{color:'#b45309'}} aria-hidden="true" />)
    const svg=element.querySelector('svg')
    expect(svg).toHaveAttribute('viewBox','0 0 24 24')
    expect(svg).toHaveAttribute('width','32')
    expect(svg).toHaveClass('product-icon')
    expect(svg).toHaveAttribute('stroke-width','2')
    expect(svg).toHaveAttribute('aria-hidden','true')
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0)
  })
})
