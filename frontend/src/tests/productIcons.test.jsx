import { describe, it, expect } from "vitest";
import {
  Banana,
  Beef,
  Cake,
  CakeSlice,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Dessert,
  Donut,
  Drumstick,
  EggFried,
  Milk,
  Pizza,
  Sandwich,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";
import { getProductIcon, CATEGORY_TINTS } from "../components/pos/productIcons";

// All Drinks share the bottle icon; everything else maps by name.
const SEED_CASES = [
  ["Espresso", "Drinks", Milk],
  ["Latte", "Drinks", Milk],
  ["Americano", "Drinks", Milk],
  ["Cappuccino", "Drinks", Milk],
  ["Iced Matcha", "Drinks", Milk],
  ["Hot Chocolate", "Drinks", Milk],
  ["Iced Coffee", "Drinks", Milk],
  ["Milk Tea", "Drinks", Milk],
  ["Club Sandwich", "Meals", Sandwich],
  ["Bacon & Egg Toast", "Meals", EggFried],
  ["Spaghetti Bolognese", "Meals", UtensilsCrossed],
  ["Chicken Alfredo", "Meals", Drumstick],
  ["Beef Tacos", "Meals", Beef],
  ["Croissant", "Pastries", Croissant],
  ["Blueberry Muffin", "Pastries", Cookie],
  ["Banana Bread", "Pastries", Banana],
  ["Cinnamon Roll", "Pastries", Donut],
  ["Chocolate Cake", "Desserts", CakeSlice],
  ["Strawberry Cheesecake", "Desserts", Cake],
  ["Tiramisu", "Desserts", Dessert],
  ["Lemon Tart", "Desserts", Citrus],
];

describe("getProductIcon", () => {
  it.each(SEED_CASES)("should map seed product %s to the right icon", (name, category, Icon) => {
    expect(getProductIcon(name, category).Icon).toBe(Icon);
  });

  it("should tint icons by category", () => {
    expect(getProductIcon("Espresso", "Drinks").tint).toBe(CATEGORY_TINTS.Drinks);
    expect(getProductIcon("Club Sandwich", "Meals").tint).toBe(CATEGORY_TINTS.Meals);
    expect(getProductIcon("Croissant", "Pastries").tint).toBe(CATEGORY_TINTS.Pastries);
    expect(getProductIcon("Tiramisu", "Desserts").tint).toBe(CATEGORY_TINTS.Desserts);
  });

  it("should respect rule ordering traps", () => {
    // "cheesecake" beats "cake"; "chicken" beats "alfredo"
    expect(getProductIcon("Strawberry Cheesecake", "Desserts").Icon).toBe(Cake);
    expect(getProductIcon("Chicken Alfredo", "Meals").Icon).toBe(Drumstick);
  });

  it("should give every drink the bottle icon regardless of name", () => {
    // Category wins over keywords — even a cake listed under Drinks.
    expect(getProductIcon("Chocolate Cake", "Drinks").Icon).toBe(Milk);
    expect(getProductIcon("Iced Coffee", "Drinks").Icon).toBe(Milk);
    expect(getProductIcon("Espresso", "Drinks").tint).toBe(CATEGORY_TINTS.Drinks);
  });

  it("should match case-insensitively", () => {
    expect(getProductIcon("ESPRESSO", "Drinks").Icon).toBe(Milk);
    expect(getProductIcon("lemon tart", "Desserts").Icon).toBe(Citrus);
  });

  it("should fall back by category for unknown names", () => {
    expect(getProductIcon("Mystery Drink", "Drinks").Icon).toBe(Milk);
    expect(getProductIcon("Mystery Meal", "Meals").Icon).toBe(UtensilsCrossed);
    expect(getProductIcon("Mystery Pastry", "Pastries").Icon).toBe(Wheat);
    expect(getProductIcon("Mystery Dessert", "Desserts").Icon).toBe(Dessert);
  });

  it("should fall back to Coffee with no tint for unknown category", () => {
    const { Icon, tint } = getProductIcon("Mystery Item", "Other");
    expect(Icon).toBe(Coffee);
    expect(tint).toBeUndefined();
  });

  it("should handle empty names via category fallback", () => {
    expect(getProductIcon("", "Drinks").Icon).toBe(Milk);
    expect(getProductIcon(null, "Meals").Icon).toBe(UtensilsCrossed);
  });

  it("should map future generic products sensibly", () => {
    expect(getProductIcon("Pepperoni Pizza", "Meals").Icon).toBe(Pizza);
    expect(getProductIcon("Fresh Milk", "Drinks").Icon).toBe(Milk);
    expect(getProductIcon("Green Apple Juice", "Specials").Icon).toBe(CupSoda);
  });
});
