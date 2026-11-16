import { createLucideIcon } from 'lucide-react'

// Original 24px outline silhouettes, using Lucide's existing SVG/ref/size API.
// Keep strokes and props consistent with the rest of the POS icon set.
export const PastaIcon = createLucideIcon('menu-pasta', [
  ['path', { d: 'M3 14h18a9 7 0 0 1-18 0ZM8 22h8', key: 'bowl' }],
  ['path', { d: 'M7 14c-3-4 5-4 2-7m2 7c-3-4 5-4 2-7', key: 'noodles' }],
  ['path', { d: 'M17 2v5m-2-5v3a2 2 0 0 0 4 0V2m-2 5v7', key: 'fork' }],
])

export const RiceBowlIcon = createLucideIcon('menu-rice-bowl', [
  ['path', { d: 'M3 12h18a9 8 0 0 1-18 0ZM9 22h6', key: 'bowl' }],
  ['path', { d: 'M5 12a3 3 0 0 1 3-4 4 4 0 0 1 8 0 3 3 0 0 1 3 4', key: 'rice' }],
  ['path', { d: 'm8 10 1-1m3 1 1-1m3 2 1-1', key: 'grains' }],
])

export const FriesIcon = createLucideIcon('menu-fries', [
  ['path', { d: 'm5 11 2 11h10l2-11-4 2H9Z', key: 'carton' }],
  ['path', { d: 'M6 11V5h3v7m1 0V2h3v11m1-1V4h3v8M10 17h4', key: 'fries' }],
])

export const TacoIcon = createLucideIcon('menu-taco', [
  ['path', { d: 'M2 19a10 13 0 0 1 20 0ZM4 19c1-8 5-12 8-12', key: 'shell' }],
  ['path', { d: 'M5 9 4 6l4 1 2-3 3 2 3-1 1 4 3 1-1 4', key: 'filling' }],
  ['path', { d: 'm10 12 1 1m3-3 1 1m2 4 1 1', key: 'texture' }],
])

export const MuffinIcon = createLucideIcon('menu-muffin', [
  ['path', { d: 'M6 12a3 3 0 0 1 1-6 5 5 0 0 1 10 0 3 3 0 0 1 1 6Z', key: 'top' }],
  ['path', { d: 'm6 12 2 10h8l2-10M10 16l1 6m3-6-1 6', key: 'wrapper' }],
])

export const BreadIcon = createLucideIcon('menu-bread', [
  ['path', { d: 'M6 10c-5 0-5-7 0-7h12c5 0 5 7 0 7v11H6Z', key: 'loaf' }],
  ['path', { d: 'M9 7h6m-5 7h.01M14 17h.01', key: 'crumb' }],
])

export const CinnamonRollIcon = createLucideIcon('menu-cinnamon-roll', [
  ['path', { d: 'M3 12c0-5 4-9 9-9s9 4 9 9-4 7-9 7-9-2-9-7Z', key: 'roll' }],
  ['path', { d: 'M7 12c0-3 2-5 5-5s5 2 5 5-3 4-5 3-2-4 0-4m-9 1v4c0 4 4 6 9 6s9-2 9-6v-4', key: 'spiral' }],
])

export const TartIcon = createLucideIcon('menu-tart', [
  ['path', { d: 'M3 10c0-4 18-4 18 0s-18 4-18 0ZM3 10l2 10h14l2-10M8 13l1 7m7-7-1 7', key: 'crust' }],
  ['path', { d: 'm10 9 2-3 2 3', key: 'filling' }],
])

export const NachosIcon = createLucideIcon('menu-nachos', [
  ['path', { d: 'm3 16 4-12 8 10Zm9-3 5-9 5 12Z', key: 'chips' }],
  ['path', { d: 'M2 18c2 4 18 4 20 0M7 10h.01m11 0h.01', key: 'plate' }],
])

export const QuesadillaIcon = createLucideIcon('menu-quesadilla', [
  ['path', { d: 'M2 18a10 10 0 0 1 20 0ZM12 18 7 10m5 8 5-8', key: 'wedges' }],
  ['path', { d: 'M4 21h16M11 9h.01M6 16h.01m12 0h.01', key: 'grill' }],
])

export const WontonIcon = createLucideIcon('menu-wonton', [
  ['path', { d: 'M3 3c4 3 6 3 9 7 3-4 5-4 9-7-3 4-3 6-7 9 4 3 4 5 7 9-4-3-6-3-9-7-3 4-5 4-9 7 3-4 3-6 7-9-4-3-4-5-7-9Z', key: 'wrapper' }],
])

export const NuggetsIcon = createLucideIcon('menu-nuggets', [
  ['path', { d: 'M3 7c-1-3 1-5 4-4l3 2c2 2 1 5-2 5H5c-2 0-3-1-2-3ZM14 6c0-3 3-4 5-2l2 3c1 3-1 5-4 4l-3-2Z', key: 'nuggets' }],
  ['path', { d: 'M8 16c0-3 3-4 5-2l2 2c2 3 0 5-3 5H9c-2 0-3-3-1-5Z', key: 'third' }],
])

export const FrappeIcon = createLucideIcon('menu-frappe', [
  ['path', { d: 'm6 10 2 12h8l2-12M5 10h14M7 10c-4-4 2-5 3-8 1 3 7 2 7 8', key: 'cream-cup' }],
  ['path', { d: 'm15 7 3-5h3M9 16h6', key: 'straw' }],
])
