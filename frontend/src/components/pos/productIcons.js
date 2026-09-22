import {
  Apple,
  Banana,
  Beef,
  Cake,
  CakeSlice,
  Candy,
  Citrus,
  Coffee,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Dessert,
  Donut,
  Drumstick,
  EggFried,
  Fish,
  IceCreamCone,
  Milk,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";

// Ordered first-match-wins rules. Compounds come before the generics they
// contain ("cheesecake" before "cake", "iced" before "coffee") so e.g.
// "Iced Coffee" reads as an iced drink and "Strawberry Cheesecake" as cake.
const ICON_RULES = [
  { keywords: ["espresso", "americano", "cappuccino", "latte", "brewed"], Icon: Coffee },
  { keywords: ["iced", "matcha", "frappe", "milk tea", "cold brew", "juice", "tea"], Icon: CupSoda },
  { keywords: ["cheesecake"], Icon: Cake },
  { keywords: ["cake"], Icon: CakeSlice },
  { keywords: ["chocolate", "cocoa", "mocha"], Icon: Coffee },
  { keywords: ["tiramisu", "pudding", "gelato"], Icon: Dessert },
  { keywords: ["ice cream"], Icon: IceCreamCone },
  { keywords: ["tart", "lemon", "citrus", "calamansi"], Icon: Citrus },
  { keywords: ["croissant"], Icon: Croissant },
  { keywords: ["muffin"], Icon: Cookie },
  { keywords: ["banana", "bread"], Icon: Banana },
  { keywords: ["cinnamon", "donut", "doughnut"], Icon: Donut },
  { keywords: ["egg", "bacon"], Icon: EggFried },
  { keywords: ["sandwich", "toast", "burger"], Icon: Sandwich },
  { keywords: ["chicken"], Icon: Drumstick },
  { keywords: ["spaghetti", "pasta", "alfredo", "carbonara", "bolognese", "lasagna"], Icon: UtensilsCrossed },
  { keywords: ["beef", "taco", "steak"], Icon: Beef },
  { keywords: ["pizza"], Icon: Pizza },
  { keywords: ["salad"], Icon: Salad },
  { keywords: ["soup"], Icon: Soup },
  { keywords: ["fish", "salmon", "tuna"], Icon: Fish },
  { keywords: ["cookie"], Icon: Cookie },
  { keywords: ["popcorn"], Icon: Popcorn },
  { keywords: ["candy"], Icon: Candy },
  { keywords: ["apple"], Icon: Apple },
  { keywords: ["milk"], Icon: Milk },
  { keywords: ["stew", "pot"], Icon: CookingPot },
];

const CATEGORY_FALLBACK = {
  Drinks: Coffee,
  Meals: UtensilsCrossed,
  Pastries: Wheat,
  Desserts: Dessert,
};

export const CATEGORY_TINTS = {
  Drinks: "#0284c7",
  Meals: "#b45309",
  Pastries: "#ea580c",
  Desserts: "#db2777",
};

// Returns { Icon, tint }. Tint is undefined for unknown categories so the
// icon falls back to the default .product-icon CSS color.
export function getProductIcon(name, category) {
  // All drinks share one bottle icon regardless of name.
  if (category === "Drinks") {
    return { Icon: Milk, tint: CATEGORY_TINTS.Drinks };
  }
  const normalized = (name || "").toLowerCase();
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((k) => normalized.includes(k))) {
      return { Icon: rule.Icon, tint: CATEGORY_TINTS[category] };
    }
  }
  return { Icon: CATEGORY_FALLBACK[category] || Coffee, tint: CATEGORY_TINTS[category] };
}
