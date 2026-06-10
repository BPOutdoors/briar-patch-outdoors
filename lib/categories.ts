export type BroadCategory = {
  slug: string
  name: string
  color: string
  description: string
  keywords: string[] // matched against category_name (case-insensitive)
}

export const BROAD_CATEGORIES: BroadCategory[] = [
  {
    slug: 'archery',
    name: 'Archery',
    color: '#4A5E2F',
    description: 'Bows, arrows, broadheads, targets & accessories',
    keywords: ['arrow', 'bow', 'archery', 'target', 'broadhead', 'quiver', 'release', 'crossbow', 'fletching', 'nock'],
  },
  {
    slug: 'hunting',
    name: 'Hunting',
    color: '#5C3A1E',
    description: 'Tree stands, blinds, calls, decoys, scents & trail cameras',
    keywords: ['hunting', 'stand', 'blind', 'call', 'decoy', 'scent', 'trail cam', 'game processing', 'predator', 'turkey', 'waterfowl', 'deer', 'big game', 'small game', 'bird'],
  },
  {
    slug: 'fishing',
    name: 'Fishing',
    color: '#1a5276',
    description: 'Rods, reels, lures, tackle & fishing accessories',
    keywords: ['fish', 'lure', 'reel', 'rod', 'tackle', 'bait', 'hook', 'jig', 'fly fishing', 'ice fishing', 'saltwater', 'freshwater', 'spinning', 'casting'],
  },
  {
    slug: 'camping',
    name: 'Camping & Outdoors',
    color: '#2e5c3a',
    description: 'Tents, sleeping bags, cookware, lighting & survival gear',
    keywords: ['camp', 'tent', 'sleep', 'backpack', 'hiking', 'cook', 'survival', 'lantern', 'knife', 'axe', 'hatchet', 'cordage', 'fire starter', 'outdoor'],
  },
  {
    slug: 'clothing',
    name: 'Clothing & Footwear',
    color: '#4a4a4a',
    description: 'Camo, base layers, boots, gloves & outdoor apparel',
    keywords: ['cloth', 'apparel', 'boot', 'shoe', 'glove', 'hat', 'cap', 'jacket', 'vest', 'pant', 'sock', 'base layer', 'wader', 'rain gear', 'camo', 'headwear', 'footwear'],
  },
  {
    slug: 'optics',
    name: 'Optics',
    color: '#1a3a4a',
    description: 'Scopes, binoculars, rangefinders & sighting systems',
    keywords: ['optic', 'scope', 'binocular', 'rangefinder', 'sight', 'glass', 'night vision', 'red dot', 'magnifier', 'spotting'],
  },
  {
    slug: 'firearms-ammo',
    name: 'Firearms & Ammo',
    color: '#7a1a1a',
    description: 'Ammunition, cleaning supplies & firearm accessories',
    keywords: ['ammo', 'ammunition', 'firearm', 'gun', 'rifle', 'pistol', 'shotgun', 'cleaning', 'holster', 'magazine', 'centerfire', 'rimfire', 'powder', 'primer', 'reloading', 'muzzleloader'],
  },
  {
    slug: 'wildlife-feeders',
    name: 'Wildlife & Feeders',
    color: '#4a3a1a',
    description: 'Feeders, feed, attractants & wildlife management',
    keywords: ['feeder', 'feed', 'wildlife', 'attract', 'mineral', 'supplement', 'plot', 'food plot', 'salt', 'corn'],
  },
  {
    slug: 'accessories',
    name: 'Other',
    color: '#5a5a5a',
    description: 'Gifts, pet supplies, auto accessories & more',
    keywords: [],
  },
]

export function getBroadCategory(categoryName: string | null): BroadCategory | null {
  if (!categoryName) return null
  const lower = categoryName.toLowerCase()
  return BROAD_CATEGORIES.find(bc =>
    bc.keywords.some(kw => lower.includes(kw))
  ) || null
}
