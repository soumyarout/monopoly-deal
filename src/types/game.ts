export type CardType = 'property' | 'cash' | 'action' | 'rent' | 'wild';
export type PropertyColor = 'brown' | 'lightblue' | 'pink' | 'orange' | 'red' | 'yellow' | 'green' | 'blue' | 'black' | 'utility';
export type GameVersion = 'us' | 'uk' | 'india';
export type AISkillLevel = 'beginner' | 'medium' | 'advanced';
export type GamePhase = 'lobby' | 'playing' | 'ended';
export type TurnPhase = 'draw' | 'play' | 'end';

export interface Card {
  id: string;
  type: CardType;
  name: string;
  value: number;
  color?: PropertyColor;
  colors?: PropertyColor[];
  description?: string;
  icon?: string;
  isWildcard?: boolean;
  isDualColor?: boolean;
  actionType?: ActionType;
  rentColors?: PropertyColor[];
}

export type ActionType =
  | 'dealbreaker'
  | 'debtcollector'
  | 'forceddeal'
  | 'slydeal'
  | 'rent'
  | 'birthday'
  | 'passgo'
  | 'house'
  | 'hotel'
  | 'sayno'
  | 'doublerent';

export interface PropertySet {
  color: PropertyColor;
  cards: Card[];
  hasHouse: boolean;
  hasHotel: boolean;
  isComplete: boolean;
}

export interface PendingPayment {
  id: string;
  creditorId: string;
  debtorId: string;
  amount: number;
  reason: string; // 'rent' | 'debtcollector' | 'birthday'
  jsnState?: { awaitingCounterFromId: string; jsnCount: number };
}

export interface PendingAction {
  id: string;
  type: 'dealbreaker' | 'slydeal' | 'forceddeal';
  actorId: string;      // who played the action card
  targetId: string;     // whose set is being stolen
  targetData: any;      // { targetPlayerId, color }
  cardId: string;       // Deal Breaker card id (already in discard)
  responderId: string;  // who needs to respond next (alternates actor ↔ target)
  jsnCount: number;     // even = action executes; odd = action cancelled
}

export interface Spectator {
  id: string;
  name: string;
  socketId: string;
}

export interface Player {
  id: string;
  name: string;
  socketId: string;
  persistentPlayerId: string;
  disconnected?: boolean;
  hand: Card[];
  bank: Card[];
  properties: PropertySet[];
  isHost: boolean;
  isReady: boolean;
  isAI?: boolean;
  aiSkill?: AISkillLevel;
  cardsPlayedThisTurn: number;
  hadZeroCardsAtEnd: boolean; // draw 5 next turn instead of 2
}

export interface GameRoom {
  id: string;
  hostId: string;
  players: Player[];
  spectators: Spectator[];
  version: GameVersion;
  phase: GamePhase;
  deck: Card[];
  discardPile: Card[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  winner: Player | null;
  createdAt: number;
  mode?: 'single' | 'multi';
  pendingPayments: PendingPayment[];
  pendingActions: PendingAction[];
  doubleRentActive: boolean; // Double the Rent card played this turn
  turnTimeLimit: number;     // seconds per turn; 0 = no limit
  turnStartedAt: number;     // ms timestamp when the current turn began
  aiSkillLevel: AISkillLevel; // skill level for AI players in this room
}

export interface GameState {
  room: GameRoom;
  currentPlayer: Player;
  myCards: Card[];
  myBank: Card[];
  myProperties: PropertySet[];
}

// Property set requirements (cards needed to complete a set)
export const PROPERTY_SET_REQUIREMENTS: Record<PropertyColor, number> = {
  brown: 2,
  lightblue: 3,
  pink: 3,
  orange: 3,
  red: 3,
  yellow: 3,
  green: 3,
  blue: 2,
  black: 4,
  utility: 2,
};

// Rent values: index = number of cards owned - 1
export const PROPERTY_SET_RENT: Record<PropertyColor, number[]> = {
  brown:    [1, 2],
  lightblue:[1, 2, 3],
  pink:     [1, 2, 4],
  orange:   [1, 3, 5],
  red:      [2, 3, 6],
  yellow:   [2, 4, 6],
  green:    [2, 4, 7],
  blue:     [3, 8],
  black:    [1, 2, 3, 4],
  utility:  [1, 2],
};
