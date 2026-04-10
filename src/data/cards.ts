import type { Card, GameVersion, PropertyColor } from '@/types/game';

// US Version Properties
const usProperties: Partial<Card>[] = [
  // Brown properties (2)
  { name: 'Mediterranean Avenue', color: 'brown', value: 1 },
  { name: 'Baltic Avenue', color: 'brown', value: 1 },
  // Light Blue properties (3)
  { name: 'Oriental Avenue', color: 'lightblue', value: 1 },
  { name: 'Vermont Avenue', color: 'lightblue', value: 1 },
  { name: 'Connecticut Avenue', color: 'lightblue', value: 1 },
  // Pink properties (3)
  { name: 'St. Charles Place', color: 'pink', value: 2 },
  { name: 'States Avenue', color: 'pink', value: 2 },
  { name: 'Virginia Avenue', color: 'pink', value: 2 },
  // Orange properties (3)
  { name: 'St. James Place', color: 'orange', value: 2 },
  { name: 'Tennessee Avenue', color: 'orange', value: 2 },
  { name: 'New York Avenue', color: 'orange', value: 2 },
  // Red properties (3)
  { name: 'Kentucky Avenue', color: 'red', value: 3 },
  { name: 'Indiana Avenue', color: 'red', value: 3 },
  { name: 'Illinois Avenue', color: 'red', value: 3 },
  // Yellow properties (3)
  { name: 'Atlantic Avenue', color: 'yellow', value: 3 },
  { name: 'Ventnor Avenue', color: 'yellow', value: 3 },
  { name: 'Marvin Gardens', color: 'yellow', value: 3 },
  // Green properties (3)
  { name: 'Pacific Avenue', color: 'green', value: 4 },
  { name: 'North Carolina Avenue', color: 'green', value: 4 },
  { name: 'Pennsylvania Avenue', color: 'green', value: 4 },
  // Blue properties (2)
  { name: 'Park Place', color: 'blue', value: 4 },
  { name: 'Boardwalk', color: 'blue', value: 4 },
  // Railroads (4)
  { name: 'Reading Railroad', color: 'black', value: 2 },
  { name: 'Pennsylvania Railroad', color: 'black', value: 2 },
  { name: 'B. & O. Railroad', color: 'black', value: 2 },
  { name: 'Short Line', color: 'black', value: 2 },
  // Utilities (2)
  { name: 'Electric Company', color: 'utility', value: 2 },
  { name: 'Water Works', color: 'utility', value: 2 },
];

// UK Version Properties
const ukProperties: Partial<Card>[] = [
  // Brown properties (2)
  { name: 'Old Kent Road', color: 'brown', value: 1 },
  { name: 'Whitechapel Road', color: 'brown', value: 1 },
  // Light Blue properties (3)
  { name: 'The Angel Islington', color: 'lightblue', value: 1 },
  { name: 'Euston Road', color: 'lightblue', value: 1 },
  { name: 'Pentonville Road', color: 'lightblue', value: 1 },
  // Pink properties (3)
  { name: 'Pall Mall', color: 'pink', value: 2 },
  { name: 'Whitehall', color: 'pink', value: 2 },
  { name: 'Northumberland Avenue', color: 'pink', value: 2 },
  // Orange properties (3)
  { name: 'Bow Street', color: 'orange', value: 2 },
  { name: 'Marlborough Street', color: 'orange', value: 2 },
  { name: 'Vine Street', color: 'orange', value: 2 },
  // Red properties (3)
  { name: 'The Strand', color: 'red', value: 3 },
  { name: 'Fleet Street', color: 'red', value: 3 },
  { name: 'Trafalgar Square', color: 'red', value: 3 },
  // Yellow properties (3)
  { name: 'Leicester Square', color: 'yellow', value: 3 },
  { name: 'Coventry Street', color: 'yellow', value: 3 },
  { name: 'Piccadilly', color: 'yellow', value: 3 },
  // Green properties (3)
  { name: 'Regent Street', color: 'green', value: 4 },
  { name: 'Oxford Street', color: 'green', value: 4 },
  { name: 'Bond Street', color: 'green', value: 4 },
  // Blue properties (2)
  { name: 'Park Lane', color: 'blue', value: 4 },
  { name: 'Mayfair', color: 'blue', value: 4 },
  // Railroads (4)
  { name: 'Kings Cross Station', color: 'black', value: 2 },
  { name: 'Marylebone Station', color: 'black', value: 2 },
  { name: 'Fenchurch St. Station', color: 'black', value: 2 },
  { name: 'Liverpool St. Station', color: 'black', value: 2 },
  // Utilities (2)
  { name: 'Electric Company', color: 'utility', value: 2 },
  { name: 'Water Works', color: 'utility', value: 2 },
];

// India Version Properties — multi-city across Mumbai, Bangalore, Kolkata, Bhubaneswar, Lucknow
const indiaProperties: Partial<Card>[] = [
  // Brown (2) — Bhubaneswar
  { name: 'Sahid Nagar', color: 'brown', value: 1 },
  { name: 'Janpath', color: 'brown', value: 1 },
  // Light Blue (3) — Lucknow
  { name: 'Hazratganj', color: 'lightblue', value: 1 },
  { name: 'Charbagh', color: 'lightblue', value: 1 },
  { name: 'Aminabad', color: 'lightblue', value: 1 },
  // Pink (3) — Kolkata
  { name: 'Park Street', color: 'pink', value: 2 },
  { name: 'Salt Lake', color: 'pink', value: 2 },
  { name: 'New Town', color: 'pink', value: 2 },
  // Orange (3) — Mumbai
  { name: 'Dadar', color: 'orange', value: 2 },
  { name: 'Parel', color: 'orange', value: 2 },
  { name: 'Worli', color: 'orange', value: 2 },
  // Red (3) — Mumbai Premium
  { name: 'Breach Candy', color: 'red', value: 3 },
  { name: 'Malabar Hill', color: 'red', value: 3 },
  { name: 'Cuffe Parade', color: 'red', value: 3 },
  // Yellow (3) — Bangalore
  { name: 'Koramangala', color: 'yellow', value: 3 },
  { name: 'Indiranagar', color: 'yellow', value: 3 },
  { name: 'Whitefield', color: 'yellow', value: 3 },
  // Green (3) — Bangalore Premium
  { name: 'MG Road', color: 'green', value: 4 },
  { name: 'UB City', color: 'green', value: 4 },
  { name: 'Lavelle Road', color: 'green', value: 4 },
  // Blue (2) — Multi-city Premium
  { name: 'Connaught Place', color: 'blue', value: 4 },
  { name: 'Nariman Point', color: 'blue', value: 4 },
  // Railroads (4) — Indian Express Trains
  { name: 'Rajdhani Express', color: 'black', value: 2 },
  { name: 'Shatabdi Express', color: 'black', value: 2 },
  { name: 'Duronto Express', color: 'black', value: 2 },
  { name: 'Metro Rail', color: 'black', value: 2 },
  // Utilities (2)
  { name: 'Power Grid', color: 'utility', value: 2 },
  { name: 'Water Supply', color: 'utility', value: 2 },
];

// Wild property cards (same for all versions)
const wildProperties: Partial<Card>[] = [
  { name: 'Wildcard', color: 'brown', colors: ['brown', 'lightblue'], value: 1, isDualColor: true },
  { name: 'Wildcard', color: 'lightblue', colors: ['lightblue', 'brown'], value: 1, isDualColor: true },
  { name: 'Wildcard', color: 'pink', colors: ['pink', 'orange'], value: 2, isDualColor: true },
  { name: 'Wildcard', color: 'orange', colors: ['orange', 'pink'], value: 2, isDualColor: true },
  { name: 'Wildcard', color: 'red', colors: ['red', 'yellow'], value: 3, isDualColor: true },
  { name: 'Wildcard', color: 'yellow', colors: ['yellow', 'red'], value: 3, isDualColor: true },
  { name: 'Wildcard', color: 'green', colors: ['green', 'blue'], value: 4, isDualColor: true },
  { name: 'Wildcard', color: 'blue', colors: ['blue', 'green'], value: 4, isDualColor: true },
  { name: 'Wildcard', color: 'utility', colors: ['utility', 'black'], value: 2, isDualColor: true },
  { name: 'Wildcard', color: 'black', colors: ['black', 'utility'], value: 2, isDualColor: true },
  { name: 'Wildcard', color: 'black', colors: ['black', 'black'], value: 2, isDualColor: true },
  { name: 'Wildcard', color: 'black', colors: ['black', 'black'], value: 2, isDualColor: true },
];

// Cash cards (same for all versions)
const cashCards: Partial<Card>[] = [
  { type: 'cash', name: '$1M', value: 1 },
  { type: 'cash', name: '$1M', value: 1 },
  { type: 'cash', name: '$1M', value: 1 },
  { type: 'cash', name: '$1M', value: 1 },
  { type: 'cash', name: '$1M', value: 1 },
  { type: 'cash', name: '$1M', value: 1 },
  { type: 'cash', name: '$2M', value: 2 },
  { type: 'cash', name: '$2M', value: 2 },
  { type: 'cash', name: '$2M', value: 2 },
  { type: 'cash', name: '$2M', value: 2 },
  { type: 'cash', name: '$2M', value: 2 },
  { type: 'cash', name: '$3M', value: 3 },
  { type: 'cash', name: '$3M', value: 3 },
  { type: 'cash', name: '$3M', value: 3 },
  { type: 'cash', name: '$4M', value: 4 },
  { type: 'cash', name: '$4M', value: 4 },
  { type: 'cash', name: '$4M', value: 4 },
  { type: 'cash', name: '$5M', value: 5 },
  { type: 'cash', name: '$5M', value: 5 },
  { type: 'cash', name: '$10M', value: 10 },
];

// Action cards (same for all versions)
const actionCards: Partial<Card>[] = [
  // Deal Breaker (2)
  { type: 'action', name: 'Deal Breaker', value: 5, actionType: 'dealbreaker', description: 'Steal a complete set from any player' },
  { type: 'action', name: 'Deal Breaker', value: 5, actionType: 'dealbreaker', description: 'Steal a complete set from any player' },
  // Debt Collector (3)
  { type: 'action', name: 'Debt Collector', value: 3, actionType: 'debtcollector', description: 'Force one player to pay you $5M' },
  { type: 'action', name: 'Debt Collector', value: 3, actionType: 'debtcollector', description: 'Force one player to pay you $5M' },
  { type: 'action', name: 'Debt Collector', value: 3, actionType: 'debtcollector', description: 'Force one player to pay you $5M' },
  // Forced Deal (3)
  { type: 'action', name: 'Forced Deal', value: 3, actionType: 'forceddeal', description: 'Swap any property with another player' },
  { type: 'action', name: 'Forced Deal', value: 3, actionType: 'forceddeal', description: 'Swap any property with another player' },
  { type: 'action', name: 'Forced Deal', value: 3, actionType: 'forceddeal', description: 'Swap any property with another player' },
  // Sly Deal (3)
  { type: 'action', name: 'Sly Deal', value: 3, actionType: 'slydeal', description: 'Steal a property from any player (not from complete sets)' },
  { type: 'action', name: 'Sly Deal', value: 3, actionType: 'slydeal', description: 'Steal a property from any player (not from complete sets)' },
  { type: 'action', name: 'Sly Deal', value: 3, actionType: 'slydeal', description: 'Steal a property from any player (not from complete sets)' },
  // Birthday (3)
  { type: 'action', name: 'It\'s My Birthday', value: 2, actionType: 'birthday', description: 'All players give you $2M' },
  { type: 'action', name: 'It\'s My Birthday', value: 2, actionType: 'birthday', description: 'All players give you $2M' },
  { type: 'action', name: 'It\'s My Birthday', value: 2, actionType: 'birthday', description: 'All players give you $2M' },
  // Pass Go (10)
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  { type: 'action', name: 'Pass Go', value: 1, actionType: 'passgo', description: 'Draw 2 extra cards' },
  // House (3)
  { type: 'action', name: 'House', value: 3, actionType: 'house', description: 'Add to any complete set to increase rent' },
  { type: 'action', name: 'House', value: 3, actionType: 'house', description: 'Add to any complete set to increase rent' },
  { type: 'action', name: 'House', value: 3, actionType: 'house', description: 'Add to any complete set to increase rent' },
  // Hotel (2)
  { type: 'action', name: 'Hotel', value: 4, actionType: 'hotel', description: 'Add to any complete set with a House' },
  { type: 'action', name: 'Hotel', value: 4, actionType: 'hotel', description: 'Add to any complete set with a House' },
  // Say No (3)
  { type: 'action', name: 'Just Say No!', value: 4, actionType: 'sayno', description: 'Cancel any action against you' },
  { type: 'action', name: 'Just Say No!', value: 4, actionType: 'sayno', description: 'Cancel any action against you' },
  { type: 'action', name: 'Just Say No!', value: 4, actionType: 'sayno', description: 'Cancel any action against you' },
  // Double the Rent (2)
  { type: 'action', name: 'Double the Rent', value: 1, actionType: 'doublerent', description: 'Play before rent to double the amount charged' },
  { type: 'action', name: 'Double the Rent', value: 1, actionType: 'doublerent', description: 'Play before rent to double the amount charged' },
];

// Rent cards (same for all versions)
const rentCards: Partial<Card>[] = [
  // Color-specific rent cards
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['brown', 'lightblue'], description: 'Charge rent for Brown or Light Blue' },
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['brown', 'lightblue'], description: 'Charge rent for Brown or Light Blue' },
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['pink', 'orange'], description: 'Charge rent for Pink or Orange' },
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['pink', 'orange'], description: 'Charge rent for Pink or Orange' },
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['red', 'yellow'], description: 'Charge rent for Red or Yellow' },
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['red', 'yellow'], description: 'Charge rent for Red or Yellow' },
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['green', 'blue'], description: 'Charge rent for Green or Blue' },
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['green', 'blue'], description: 'Charge rent for Green or Blue' },
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['black', 'utility'], description: 'Charge rent for Railroad or Utility' },
  { type: 'rent', name: 'Rent', value: 1, actionType: 'rent', rentColors: ['black', 'utility'], description: 'Charge rent for Railroad or Utility' },
  // Wild rent cards (charge any color)
  { type: 'rent', name: 'Rent Wild', value: 3, actionType: 'rent', description: 'Charge rent for any color' },
  { type: 'rent', name: 'Rent Wild', value: 3, actionType: 'rent', description: 'Charge rent for any color' },
  { type: 'rent', name: 'Rent Wild', value: 3, actionType: 'rent', description: 'Charge rent for any color' },
];

// Function to generate full deck for a version
export function generateDeck(version: GameVersion): Card[] {
  const deck: Card[] = [];
  let id = 0;

  // Get properties based on version
  let properties: Partial<Card>[] = [];
  switch (version) {
    case 'us':
      properties = usProperties;
      break;
    case 'uk':
      properties = ukProperties;
      break;
    case 'india':
      properties = indiaProperties;
      break;
  }

  // Add properties (1 of each)
  properties.forEach((prop) => {
    deck.push({
      ...prop,
      id: `card-${id++}`,
      type: 'property',
    } as Card);
  });

  // Add wild properties
  wildProperties.forEach((prop) => {
    deck.push({
      ...prop,
      id: `card-${id++}`,
      type: 'property',
    } as Card);
  });

  // Add cash cards
  cashCards.forEach((cash) => {
    deck.push({
      ...cash,
      id: `card-${id++}`,
    } as Card);
  });

  // Add action cards
  actionCards.forEach((action) => {
    deck.push({
      ...action,
      id: `card-${id++}`,
    } as Card);
  });

  // Add rent cards
  rentCards.forEach((rent) => {
    deck.push({
      ...rent,
      id: `card-${id++}`,
    } as Card);
  });

  return shuffleDeck(deck);
}

// Shuffle deck using Fisher-Yates algorithm
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Draw cards from deck
export function drawCards(deck: Card[], count: number): { cards: Card[]; remainingDeck: Card[] } {
  const cards = deck.slice(0, count);
  const remainingDeck = deck.slice(count);
  return { cards, remainingDeck };
}

// Return all standard (non-wildcard) property names for a given color + version
export function getPropertyNamesByColor(color: PropertyColor, version: GameVersion): string[] {
  const props = version === 'us' ? usProperties
    : version === 'uk' ? ukProperties
    : indiaProperties;
  return props.filter(p => p.color === color && p.name).map(p => p.name as string);
}

// Get color display name
export function getColorDisplayName(color: PropertyColor): string {
  const names: Record<PropertyColor, string> = {
    brown: 'Brown',
    lightblue: 'Light Blue',
    pink: 'Pink',
    orange: 'Orange',
    red: 'Red',
    yellow: 'Yellow',
    green: 'Green',
    blue: 'Blue',
    black: 'Railroad',
    utility: 'Utility',
  };
  return names[color] || color;
}

// Get color class for styling
export function getColorClass(color: PropertyColor): string {
  const classes: Record<PropertyColor, string> = {
    brown: 'bg-amber-800',
    lightblue: 'bg-sky-300',
    pink: 'bg-pink-400',
    orange: 'bg-orange-500',
    red: 'bg-red-600',
    yellow: 'bg-yellow-400',
    green: 'bg-green-600',
    blue: 'bg-blue-700',
    black: 'bg-gray-900',
    utility: 'bg-amber-500',
  };
  return classes[color] || 'bg-gray-500';
}

// Get text color class for property colors
export function getTextColorClass(color: PropertyColor): string {
  const classes: Record<PropertyColor, string> = {
    brown: 'text-amber-800',
    lightblue: 'text-sky-700',
    pink: 'text-pink-600',
    orange: 'text-orange-600',
    red: 'text-red-700',
    yellow: 'text-yellow-700',
    green: 'text-green-700',
    blue: 'text-blue-800',
    black: 'text-gray-900',
    utility: 'text-amber-700',
  };
  return classes[color] || 'text-gray-700';
}
