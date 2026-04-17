import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type { GameRoom, Player, Card, PropertySet, GameVersion, PendingPayment, PendingAction, Spectator, PropertyColor, AISkillLevel } from '../src/types/game';
import { PROPERTY_SET_REQUIREMENTS, PROPERTY_SET_RENT } from '../src/types/game';
import { generateDeck, shuffleDeck } from '../src/data/cards.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],  // polling as fallback for restrictive proxies
  pingInterval: 25000,  // ping every 25s
  pingTimeout: 60000,   // 60s timeout — generous for mobile/slow connections
});

app.use(express.static(path.join(__dirname, '../dist')));
app.use(express.json());

/* ─── Admin auth middleware ─── */
const ADMIN_KEY = process.env.ADMIN_KEY || '4m65go4KNM0WWcmEbNJHvOF67Yzxaijxu8FuL1E5rAA=';

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const key = (req.headers['x-admin-key'] as string | undefined) || (req.query['key'] as string | undefined);
  if (key !== ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/* ─── Admin REST routes ─── */
app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const roomList = [...rooms.entries()].map(([id, room]) => {
    const ageMs   = Date.now() - room.createdAt;
    const ageMins = Math.floor(ageMs / 60000);
    const activePlayer = room.players[room.currentPlayerIndex];
    return {
      id,
      phase:            room.phase,
      version:          room.version,
      mode:             room.mode ?? 'multi',
      createdAt:        room.createdAt,
      ageMinutes:       ageMins,
      turnTimeLimit:    room.turnTimeLimit,
      timerPaused:      room.timerPaused ?? false,
      pendingPayments:  room.pendingPayments.length,
      pendingActions:   room.pendingActions.length,
      deckRemaining:    room.deck.length,
      discardCount:     room.discardPile.length,
      winner:           room.winner ? room.winner.name : null,
      activePlayerName: activePlayer ? activePlayer.name : null,
      players: room.players.map(p => ({
        id:           p.id,
        name:         p.name,
        isAI:         p.isAI ?? false,
        aiSkill:      p.aiSkill ?? null,
        isHost:       p.isHost,
        disconnected: p.disconnected ?? false,
        handCount:    p.hand.length,
        bankTotal:    p.bank.reduce((s, c) => s + c.value, 0),
        propertySets: p.properties.filter(ps => ps.cards.length > 0).length,
        completeSets: p.properties.filter(ps => ps.isComplete).length,
      })),
      spectatorCount: room.spectators.length,
    };
  });

  res.json({
    serverTime:   Date.now(),
    totalRooms:   rooms.size,
    playingRooms: roomList.filter(r => r.phase === 'playing').length,
    lobbyRooms:   roomList.filter(r => r.phase === 'lobby').length,
    endedRooms:   roomList.filter(r => r.phase === 'ended').length,
    totalPlayers: roomList.reduce((s, r) => s + r.players.length, 0),
    rooms: roomList,
  });
});

app.delete('/api/admin/rooms/:id', requireAdmin, (req, res) => {
  const roomId = req.params.id;
  if (!rooms.has(roomId)) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  io.to(roomId).emit('error', { message: 'This room was closed by the administrator.' });
  // Disconnect all sockets from this room
  io.in(roomId).socketsLeave(roomId);
  rooms.delete(roomId);
  const timer = turnTimers.get(roomId);
  if (timer) { clearTimeout(timer); turnTimers.delete(roomId); }
  res.json({ success: true, roomId });
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', rooms: rooms.size }));
app.use((_req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));

const rooms: Map<string, GameRoom> = new Map();
const turnTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
// Grace period timers for disconnected players (60 s before removal)
const disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
// Timers for auto-resolving pending Deal Breaker JSN decisions (15 s)
const actionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
// Timers for auto-resolving JSN counter-opportunity on payments (10 s)
const jsnCounterTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

const AI_NAMES = ['Carlos', 'Bentley', 'Ferrari', 'Lambert', 'Royce', 'Maybach', 'Aston', 'Jaguar'];

function pickAIName(existingPlayers: Player[]): string {
  const usedNames = existingPlayers.filter(p => p.isAI).map(p => p.name.replace(' (AI)', ''));
  const available = AI_NAMES.filter(n => !usedNames.includes(n));
  const pool = available.length > 0 ? available : AI_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Turn Timer ──────────────────────────────────────────────────────────────

function clearTurnTimer(roomId: string) {
  const t = turnTimers.get(roomId);
  if (t) { clearTimeout(t); turnTimers.delete(roomId); }
}

function startTurnTimer(roomId: string, room: GameRoom) {
  clearTurnTimer(roomId);
  if (!room.turnTimeLimit) return;

  const timer = setTimeout(() => {
    const r = rooms.get(roomId);
    if (!r || r.phase !== 'playing' || r.pendingPayments.length > 0) return;

    const player = r.players[r.currentPlayerIndex];
    if (!player) return;

    // Auto-draw if still in draw phase
    if (r.turnPhase === 'draw') {
      const count = player.hadZeroCardsAtEnd ? 5 : 2;
      player.hadZeroCardsAtEnd = false;
      player.hand.push(...safeDraw(r, count));
      r.turnPhase = 'play';
    }

    // Auto-discard randomly down to 7
    while (player.hand.length > 7) {
      const idx = Math.floor(Math.random() * player.hand.length);
      r.discardPile.push(player.hand.splice(idx, 1)[0]);
    }

    io.to(roomId).emit('turn-timeout', { room: r });
    advanceTurn(r, roomId);
  }, room.turnTimeLimit * 1000);

  turnTimers.set(roomId, timer);
}

/** Pause the turn timer when human players are paying rent/debt. */
function pauseTurnTimer(roomId: string, room: GameRoom): void {
  if (!room.turnTimeLimit || room.timerPaused) return;
  clearTurnTimer(roomId);
  const elapsed = Math.floor((Date.now() - room.turnStartedAt) / 1000);
  room.turnElapsedBeforePause = (room.turnElapsedBeforePause ?? 0) + elapsed;
  room.timerPaused = true;
}

/** Resume the turn timer after all payments are collected. */
function resumeTurnTimer(roomId: string, room: GameRoom): void {
  if (!room.turnTimeLimit || !room.timerPaused) return;
  room.timerPaused = false;
  const elapsed = room.turnElapsedBeforePause ?? 0;
  // Shift turnStartedAt so the client countdown still reflects remaining time
  room.turnStartedAt = Date.now() - elapsed * 1000;
  room.turnElapsedBeforePause = 0;

  const remaining = Math.max(1, room.turnTimeLimit - elapsed);
  const timer = setTimeout(() => {
    const r = rooms.get(roomId);
    if (!r || r.phase !== 'playing' || r.pendingPayments.length > 0 || r.timerPaused) return;

    const player = r.players[r.currentPlayerIndex];
    if (!player) return;

    if (r.turnPhase === 'draw') {
      const count = player.hadZeroCardsAtEnd ? 5 : 2;
      player.hadZeroCardsAtEnd = false;
      player.hand.push(...safeDraw(r, count));
      r.turnPhase = 'play';
    }
    while (player.hand.length > 7) {
      const idx = Math.floor(Math.random() * player.hand.length);
      r.discardPile.push(player.hand.splice(idx, 1)[0]);
    }
    io.to(roomId).emit('turn-timeout', { room: r });
    advanceTurn(r, roomId);
  }, remaining * 1000);
  turnTimers.set(roomId, timer);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Score how close a player is to winning — higher = more dangerous target.
 *  Each complete set = 1.0; partial set = cards/required (0..1). */
function playerThreatScore(p: Player): number {
  return p.properties.reduce((score, set) => {
    if (set.cards.length === 0) return score;
    const req = PROPERTY_SET_REQUIREMENTS[set.color] ?? 3;
    return score + (set.isComplete ? 1 : set.cards.length / req);
  }, 0);
}

function createPlayer(name: string, socketId: string, isHost: boolean, isAI = false, persistentPlayerId?: string, aiSkill?: AISkillLevel): Player {
  return {
    id: uuidv4(),
    name,
    socketId,
    persistentPlayerId: persistentPlayerId ?? uuidv4(),
    hand: [], bank: [], properties: [],
    isHost, isReady: true, isAI,
    aiSkill,
    cardsPlayedThisTurn: 0,
    hadZeroCardsAtEnd: false,
    powerCardStats: {},
  };
}

function createEmptyPropertySets(): PropertySet[] {
  const colors = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'black', 'utility'] as const;
  return colors.map(color => ({ color, cards: [], hasHouse: false, hasHotel: false, isComplete: false }));
}

function dealInitialCards(room: GameRoom): void {
  // Initialise empty hands and property sets
  room.players.forEach(player => {
    player.hand = [];
    player.properties = createEmptyPropertySets();
  });
  // Deal round-robin (1 card per player per round × 5 rounds) — same as a real dealer
  for (let round = 0; round < 5; round++) {
    for (const player of room.players) {
      const [card] = safeDraw(room, 1);
      if (card) player.hand.push(card);
    }
  }
}

function checkPropertySetComplete(set: PropertySet): boolean {
  return set.cards.length >= PROPERTY_SET_REQUIREMENTS[set.color];
}

/** Return house/hotel cards to discard when a set loses completeness. */
function clearSetImprovements(set: PropertySet, discardPile: Card[]): void {
  if (set.houseCard) { discardPile.push(set.houseCard); set.houseCard = undefined; }
  if (set.hotelCard) { discardPile.push(set.hotelCard); set.hotelCard = undefined; }
  set.hasHouse = false;
  set.hasHotel = false;
}

function checkWinner(room: GameRoom): Player | null {
  for (const player of room.players) {
    if (player.properties.filter(s => s.isComplete).length >= 3) return player;
  }
  return null;
}

/** Draw safely, reshuffling discard pile if deck runs out (spec §9.6). */
function safeDraw(room: GameRoom, count: number, roomId?: string): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      if (room.discardPile.length === 0) break;
      // Shuffle twice for thorough randomisation
      room.deck = shuffleDeck(shuffleDeck([...room.discardPile]));
      room.discardPile = [];
      // Notify all players so the reshuffle is visible
      if (roomId) io.to(roomId).emit('deck-reshuffled', {});
    }
    if (room.deck.length > 0) drawn.push(room.deck.splice(0, 1)[0]);
  }
  return drawn;
}

/** Calculate rent for a color set, including house/hotel bonuses (spec §8.3). */
function calculateRent(player: Player, color: PropertyColor, doubled: boolean): number {
  const set = player.properties.find(p => p.color === color);
  if (!set || set.cards.length === 0) return 0;
  const table = PROPERTY_SET_RENT[color];
  let rent = table[Math.min(set.cards.length - 1, table.length - 1)] ?? 0;
  if (set.hasHouse) rent += 3;
  if (set.hasHotel) rent += 4;
  if (doubled) rent *= 2;
  return rent;
}

/**
 * Create payment requests for human players; AI pays immediately (spec §6).
 * Returns true if any payments are pending.
 */
function requestPayments(
  room: GameRoom, roomId: string,
  creditor: Player, debtors: Player[],
  amount: number, reason: string,
): void {
  let hasHumanDebtor = false;
  for (const debtor of debtors) {
    if (debtor.id === creditor.id) continue;
    const hasAnything = debtor.bank.length > 0 || debtor.properties.some(s => s.cards.length > 0);
    if (!hasAnything) continue; // nothing to collect — skip
    if (debtor.isAI) {
      aiPay(room, debtor, creditor, amount);
    } else {
      const paymentId = uuidv4();
      room.pendingPayments.push({ id: paymentId, creditorId: creditor.id, debtorId: debtor.id, amount, reason });
      // Notify the specific debtor
      io.to(roomId).emit('payment-request', { paymentId, creditorId: creditor.id, creditorName: creditor.name, amount, reason, room });
      hasHumanDebtor = true;
    }
  }
  // Pause the turn timer while human players are paying — resumes when all pay
  if (hasHumanDebtor) pauseTurnTimer(roomId, room);
}

/** Auto-pay debt for AI: bank first (smallest), then incomplete properties only — complete sets are protected. */
function aiPay(room: GameRoom, debtor: Player, creditor: Player, amount: number): void {
  let remaining = amount;
  const bankSorted = [...debtor.bank].sort((a, b) => a.value - b.value);
  for (const card of bankSorted) {
    if (remaining <= 0) break;
    const idx = debtor.bank.findIndex(c => c.id === card.id);
    if (idx !== -1) {
      debtor.bank.splice(idx, 1);
      // Property/wild cards route to creditor's properties, never their cash bank
      if ((card.type === 'property' || card.type === 'wild') && card.color) {
        const cs = creditor.properties.find(p => p.color === card.color as PropertyColor);
        if (cs) { cs.cards.push(card); cs.isComplete = checkPropertySetComplete(cs); }
        else { creditor.properties.push({ color: card.color as PropertyColor, cards: [card], hasHouse: false, hasHotel: false, isComplete: false }); }
      } else {
        creditor.bank.push(card);
      }
      remaining -= card.value;
    }
  }
  if (remaining > 0) {
    // Only pay from incomplete sets — complete sets are protected (same rule as human payment)
    for (const set of debtor.properties.filter(s => !s.isComplete && s.cards.length > 0)) {
      while (set.cards.length > 0 && remaining > 0) {
        const card = set.cards.pop()!;
        set.isComplete = checkPropertySetComplete(set);
        if (!set.isComplete) clearSetImprovements(set, room.discardPile);
        card.color = set.color; // keep card.color in sync
        const cs = creditor.properties.find(p => p.color === set.color);
        if (cs) {
          cs.cards.push(card); cs.isComplete = checkPropertySetComplete(cs);
        } else {
          // Creditor has no slot for this color — create one (should never happen with createEmptyPropertySets)
          creditor.properties.push({ color: set.color, cards: [card], hasHouse: false, hasHotel: false, isComplete: false });
        }
        remaining -= card.value;
      }
    }
  }
}

/** Transfer bank + property cards from debtor to creditor (spec §6). */
function processPayment(
  room: GameRoom,
  payment: PendingPayment,
  bankCardIds: string[],
  propertyCards: { color: PropertyColor; cardId: string }[],
): void {
  const debtor = room.players.find(p => p.id === payment.debtorId);
  const creditor = room.players.find(p => p.id === payment.creditorId);
  if (!debtor || !creditor) return;

  // Bank cards: cash/action → creditor.bank; property/wild → creditor.properties (never cash)
  for (const cardId of bankCardIds) {
    const idx = debtor.bank.findIndex(c => c.id === cardId);
    if (idx === -1) continue;
    const [card] = debtor.bank.splice(idx, 1);
    if ((card.type === 'property' || card.type === 'wild') && card.color) {
      const creditorSet = creditor.properties.find(p => p.color === card.color as PropertyColor);
      if (creditorSet) {
        creditorSet.cards.push(card); creditorSet.isComplete = checkPropertySetComplete(creditorSet);
      } else {
        creditor.properties.push({ color: card.color as PropertyColor, cards: [card], hasHouse: false, hasHotel: false, isComplete: false });
      }
    } else {
      creditor.bank.push(card);
    }
  }

  // Property cards: debtor.properties → creditor.properties (always goes to property, never bank)
  for (const { color, cardId } of propertyCards) {
    const debtorSet = debtor.properties.find(p => p.color === color);
    if (!debtorSet) continue;
    if (debtorSet.isComplete) continue; // complete sets protected
    const ci = debtorSet.cards.findIndex(c => c.id === cardId);
    if (ci === -1) continue;
    const [card] = debtorSet.cards.splice(ci, 1);
    debtorSet.isComplete = checkPropertySetComplete(debtorSet);
    if (!debtorSet.isComplete) clearSetImprovements(debtorSet, room.discardPile);
    card.color = color; // keep card.color in sync with set
    const creditorSet = creditor.properties.find(p => p.color === color);
    if (creditorSet) {
      creditorSet.cards.push(card); creditorSet.isComplete = checkPropertySetComplete(creditorSet);
    } else {
      // No slot found — create one (safety net; should not happen after createEmptyPropertySets)
      creditor.properties.push({ color, cards: [card], hasHouse: false, hasHotel: false, isComplete: false });
    }
  }
}

// ─── AI Helpers ──────────────────────────────────────────────────────────────

/**
 * Score a hand card for end-of-turn discard selection.
 * Lower score = discard sooner. Power cards are never discarded unless
 * there is literally nothing else left.
 */
function aiDiscardPriority(card: Card): number {
  // Low cash — cheapest to lose
  if (card.type === 'cash') return card.value;                   // 1–10
  // Pass Go / Double Rent — low value, easily replaceable
  if (card.actionType === 'passgo')     return 1.5;
  if (card.actionType === 'doublerent') return 2;
  // Rent cards — situational but not as critical as attack cards
  if (card.type === 'rent')             return 9;
  // Properties / wildcards — don't throw away unplayed properties
  if (card.type === 'property' || card.type === 'wild') return 15;
  // Power action cards — keep these at all costs
  if (card.actionType === 'house')         return 12;
  if (card.actionType === 'hotel')         return 12;
  if (card.actionType === 'birthday')      return 16;
  if (card.actionType === 'debtcollector') return 16;
  if (card.actionType === 'forceddeal')    return 17;
  if (card.actionType === 'slydeal')       return 18;
  if (card.actionType === 'dealbreaker')   return 19;
  if (card.actionType === 'sayno')         return 20;
  return card.value;
}

/**
 * Rearrange multi-color wildcards to the set where they contribute most
 * to completion. Free action (spec §9.3).
 */
function aiRearrangeWildcards(room: GameRoom, player: Player): void {
  for (const set of player.properties) {
    for (let i = set.cards.length - 1; i >= 0; i--) {
      const card = set.cards[i];
      if (!card.colors || card.colors.length < 2) continue;
      const validColors = [...new Set(card.colors)] as PropertyColor[];
      if (validColors.length < 2) continue;

      const reqCurrent = PROPERTY_SET_REQUIREMENTS[set.color] ?? 3;
      let bestCol: PropertyColor = set.color;
      let bestGain = 0;

      for (const col of validColors) {
        if (col === set.color) continue;
        const reqTarget = PROPERTY_SET_REQUIREMENTS[col] ?? 3;
        const gain = (1 / reqTarget) - (1 / reqCurrent);
        if (gain > bestGain) { bestGain = gain; bestCol = col; }
      }

      if (bestCol !== set.color) {
        set.cards.splice(i, 1);
        set.isComplete = checkPropertySetComplete(set);
        if (!set.isComplete) clearSetImprovements(set, room.discardPile);
        card.color = bestCol;
        const toSet = player.properties.find(p => p.color === bestCol);
        if (toSet) { toSet.cards.push(card); toSet.isComplete = checkPropertySetComplete(toSet); }
      }
    }
  }
}

/**
 * For a wildcard with multiple valid colors, return the color where placing
 * it makes the most progress toward a complete set.
 */
function aiBestColorForWild(player: Player, card: Card): PropertyColor {
  const validColors = [...new Set(card.colors ?? [])] as PropertyColor[];
  if (validColors.length === 0) return card.color as PropertyColor;
  if (validColors.length === 1) return validColors[0];

  // Skip complete sets — wildcards cannot be added to a full set
  const openColors = validColors.filter(col => {
    const set = player.properties.find(p => p.color === col);
    return !set?.isComplete;
  });
  if (openColors.length === 0) return card.color as PropertyColor; // no valid placement available
  const candidates = openColors;

  let bestCol = candidates[0];
  let bestScore = -1;
  for (const col of candidates) {
    const set = player.properties.find(p => p.color === col);
    const req = PROPERTY_SET_REQUIREMENTS[col] ?? 3;
    const cur = set?.cards.length ?? 0;
    const score = (cur + 1) / req + (1 / req) * 0.01;
    if (score > bestScore) { bestScore = score; bestCol = col; }
  }
  return bestCol;
}

// ─── AI Turn ─────────────────────────────────────────────────────────────────

/**
 * Beginner AI: plays all card types but makes poor strategic decisions.
 * - Wildcards/properties placed at a random valid color (not optimised for set completion)
 * - Rent charged for a random available color (not the highest-value one)
 * - Sly Deal steals a random card from a random opponent (not the most useful one)
 * - Forced Deal swaps randomly (doesn't check value or completion impact)
 * - Deal Breaker targets a random complete set (not the most damaging one)
 * - Debt Collector targets a random opponent (not the richest)
 * - Passgo played immediately without evaluating hand size
 * - Never uses Double Rent
 */
function processBeginnerAITurn(room: GameRoom, roomId: string, player: Player): void {
  const others = room.players.filter(p => p.id !== player.id);

  // Rearrange wildcards to best color even for beginner
  aiRearrangeWildcards(room, player);

  // Shuffle hand for random play order (excluding sayno/doublerent — those are situational)
  const available = [...player.hand]
    .filter(c => c.actionType !== 'sayno' && c.actionType !== 'doublerent');
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  let played = 0;
  for (const card of available) {
    if (played >= 3) break;
    const idx = player.hand.findIndex(c => c.id === card.id);
    if (idx === -1) continue;
    player.hand.splice(idx, 1);

    if (card.type === 'property' || card.type === 'wild') {
      // Pick a random valid color instead of the strategically best one (but skip complete sets)
      const validColors = card.colors?.length
        ? [...new Set(card.colors)] as PropertyColor[]
        : [card.color as PropertyColor];
      const openColors = validColors.filter(c => {
        const s = player.properties.find(p => p.color === c);
        return !s?.isComplete;
      });
      const color = openColors.length > 0
        ? openColors[Math.floor(Math.random() * openColors.length)]
        : null;
      if (color) {
        card.color = color;
        const set = player.properties.find(p => p.color === color);
        if (set && !set.isComplete) { set.cards.push(card); set.isComplete = checkPropertySetComplete(set); }
        else { player.hand.push(card); continue; } // set somehow full — keep in hand, skip play
      } else {
        player.hand.push(card); // all matching sets are complete — keep in hand, skip play
        continue;
      }
    } else if (card.type === 'cash') {
      player.bank.push(card);
    } else if (card.type === 'rent') {
      room.discardPile.push(card);
      const validColors = (card.rentColors?.length
        ? card.rentColors.filter(c => (player.properties.find(p => p.color === c)?.cards.length ?? 0) > 0)
        : player.properties.filter(s => s.cards.length > 0).map(s => s.color)) as PropertyColor[];
      if (validColors.length > 0) {
        // Pick a random color instead of the highest-rent one
        const color = validColors[Math.floor(Math.random() * validColors.length)];
        const rent = calculateRent(player, color, false);
        if (rent > 0) requestPayments(room, roomId, player, others, rent, 'rent');
      }
      played++;
      if (room.pendingPayments.length > 0) break;
      continue;
    } else if (card.type === 'action') {
      let targetData: Record<string, unknown> | null = null;

      if (card.actionType === 'passgo') {
        // Always play passgo (no hand-size check)
        targetData = null;
      } else if (card.actionType === 'birthday') {
        targetData = null;
      } else if (card.actionType === 'debtcollector') {
        // Target the most dangerous opponent (closest to winning)
        const byThreat = [...others].sort((a, b) => playerThreatScore(b) - playerThreatScore(a));
        const target = byThreat[0] ?? others[0];
        targetData = target ? { targetPlayerId: target.id } : null;
      } else if (card.actionType === 'dealbreaker') {
        // Only use Deal Breaker when have ≥1 complete set (going for win) or opponent near win — human-like timing
        const myCompleteSets = player.properties.filter(s => s.isComplete).length;
        const oppNearWin = others.some(o => o.properties.filter(s => s.isComplete).length >= 2);
        if (myCompleteSets >= 1 || oppNearWin) {
          const oppsWithSets = others.filter(o => o.properties.some(s => s.isComplete))
            .sort((a, b) => playerThreatScore(b) - playerThreatScore(a));
          const opp = oppsWithSets[0];
          if (opp) {
            const completeSets = opp.properties.filter(s => s.isComplete);
            const set = completeSets[Math.floor(Math.random() * completeSets.length)];
            targetData = set ? { targetPlayerId: opp.id, color: set.color } : null;
          }
        }
      } else if (card.actionType === 'slydeal') {
        // Steal from the most dangerous opponent's incomplete set
        const oppsWithProps = others.filter(o => o.properties.some(s => !s.isComplete && s.cards.length > 0))
          .sort((a, b) => playerThreatScore(b) - playerThreatScore(a));
        const opp = oppsWithProps[0];
        if (opp) {
          const incompSets = opp.properties.filter(s => !s.isComplete && s.cards.length > 0);
          const set = incompSets[Math.floor(Math.random() * incompSets.length)];
          if (set) {
            const c = set.cards[Math.floor(Math.random() * set.cards.length)];
            targetData = { targetPlayerId: opp.id, color: set.color, cardId: c.id };
          }
        }
      } else if (card.actionType === 'forceddeal') {
        // Swap with the most dangerous opponent's incomplete set
        const oppsWithProps = others.filter(o => o.properties.some(s => !s.isComplete && s.cards.length > 0))
          .sort((a, b) => playerThreatScore(b) - playerThreatScore(a));
        const opp = oppsWithProps[0];
        const myIncompSets = player.properties.filter(s => s.cards.length > 0);
        if (opp && myIncompSets.length > 0) {
          const theirSets = opp.properties.filter(s => !s.isComplete && s.cards.length > 0);
          const theirSet = theirSets[Math.floor(Math.random() * theirSets.length)];
          const mySet = myIncompSets[Math.floor(Math.random() * myIncompSets.length)];
          if (theirSet && mySet) {
            const theirCard = theirSet.cards[Math.floor(Math.random() * theirSet.cards.length)];
            const myCard = mySet.cards[Math.floor(Math.random() * mySet.cards.length)];
            targetData = {
              targetPlayerId: opp.id,
              theirColor: theirSet.color, theirCardId: theirCard.id,
              myColor: mySet.color, myCardId: myCard.id,
            };
          }
        }
      } else if (card.actionType === 'house' || card.actionType === 'hotel') {
        const eligible = player.properties.filter(s =>
          s.color !== 'black' && s.color !== 'utility' &&
          (card.actionType === 'house' ? (s.isComplete && !s.hasHouse) : (s.isComplete && s.hasHouse && !s.hasHotel))
        );
        const set = eligible[Math.floor(Math.random() * eligible.length)];
        targetData = set ? { color: set.color } : null;
      }

      if (targetData !== null || ['passgo', 'birthday'].includes(card.actionType ?? '')) {
        handleActionCard(room, roomId, player, card, targetData);
        played++;
        if (room.pendingPayments.length > 0 || room.pendingActions.length > 0) break;
        continue;
      } else {
        // No valid target — bank the card as cash instead
        player.bank.push(card);
      }
    }
    played++;
  }

  // Discard down to 7 at end of turn (rule §4.5) — lowest-priority cards first
  if (player.hand.length > 7) {
    player.hand.sort((a, b) => aiDiscardPriority(a) - aiDiscardPriority(b));
    while (player.hand.length > 7) room.discardPile.push(player.hand.shift()!);
  }
  player.cardsPlayedThisTurn = 0;
  advanceTurn(room, roomId);
}

function processAITurn(room: GameRoom, player: Player): void {
  if (!player.isAI) return;

  const roomId = [...rooms.entries()].find(([, r]) => r === room)?.[0] || '';
  const skill = player.aiSkill ?? 'medium';

  const drawCount = player.hadZeroCardsAtEnd ? 5 : 2;
  player.hadZeroCardsAtEnd = false;
  player.hand.push(...safeDraw(room, drawCount, roomId));

  if (skill === 'beginner') {
    processBeginnerAITurn(room, roomId, player);
    return;
  }

  // Medium / Advanced: strategic play
  aiRearrangeWildcards(room, player);

  // Human-like strategic play
  const others = room.players.filter(p => p.id !== player.id);

  let played = 0;
  while (played < 3 && player.hand.length > 0) {
    const props  = player.hand.filter(c => c.type === 'property' || c.type === 'wild');
    const cash   = player.hand.filter(c => c.type === 'cash');
    const acts   = player.hand.filter(c => c.type === 'action' && c.actionType !== 'sayno' && c.actionType !== 'doublerent');
    const rents  = player.hand.filter(c => c.type === 'rent');

    let chosenCard: Card | null = null;
    let chosenTarget: Record<string, unknown> | null = null;

    const mySets = player.properties.filter(s => s.isComplete).length;
    const hasJsn = player.hand.some(c => c.actionType === 'sayno');
    const myExposedCount = player.properties.reduce((sum, s) => sum + s.cards.length, 0);
    const isEarlyGame = mySets === 0 && myExposedCount < 3;
    const opponentNearWin = others.some(o => o.properties.filter(s => s.isComplete).length >= 2);
    const canUseDealBreaker = mySets >= 2 || opponentNearWin;

    // 1. Complete a set immediately — always top priority
    if (!chosenCard) {
      for (const card of props) {
        const color = (card.type === 'wild' && card.colors?.length)
          ? aiBestColorForWild(player, card)
          : card.color as PropertyColor;
        if (!color) continue;
        const set = player.properties.find(p => p.color === color);
        const req = PROPERTY_SET_REQUIREMENTS[color] ?? 3;
        if (set && set.cards.length === req - 1 && !set.isComplete) {
          chosenCard = card; chosenTarget = { color }; break;
        }
      }
    }

    // 2. PassGo — refuel when hand is thin
    if (!chosenCard) {
      const passgo = acts.find(c => c.actionType === 'passgo');
      if (passgo && player.hand.length <= 5) chosenCard = passgo;
    }

    // 3. Early game: bank cash before exposing properties (build financial safety net first)
    if (!chosenCard && isEarlyGame && cash.length > 0) {
      chosenCard = [...cash].sort((a, b) => a.value - b.value)[0];
    }

    // 4. Deal Breaker — only when going for the win (≥2 sets) or blocking a near-winner
    if (!chosenCard && canUseDealBreaker) {
      const db = acts.find(c => c.actionType === 'dealbreaker');
      if (db) {
        const sortedOthers = [...others].sort((a, b) => playerThreatScore(b) - playerThreatScore(a));
        for (const opp of sortedOthers) {
          for (const set of opp.properties.filter(s => s.isComplete)) {
            const mySet = player.properties.find(p => p.color === set.color);
            if (!mySet?.isComplete) {
              chosenCard = db; chosenTarget = { targetPlayerId: opp.id, color: set.color }; break;
            }
          }
          if (chosenCard) break;
        }
      }
    }

    // 5. Sly Deal — steal card that most completes our sets (highest-threat opponent first)
    if (!chosenCard) {
      const sly = acts.find(c => c.actionType === 'slydeal');
      if (sly) {
        const sortedOthers = [...others].sort((a, b) => playerThreatScore(b) - playerThreatScore(a));
        let bestOpp: Player | null = null, bestColor: PropertyColor | null = null, bestCardId: string | null = null, bestScore = -1;
        for (const opp of sortedOthers) {
          for (const set of opp.properties.filter(s => !s.isComplete && s.cards.length > 0)) {
            for (const c of set.cards) {
              const mySet = player.properties.find(p => p.color === set.color);
              const req = PROPERTY_SET_REQUIREMENTS[set.color] ?? 3;
              const cur = mySet?.cards.length ?? 0;
              const score = (cur + 1) / req + c.value / 20;
              if (score > bestScore) { bestScore = score; bestOpp = opp; bestColor = set.color; bestCardId = c.id; }
            }
          }
        }
        if (bestOpp && bestColor && bestCardId) { chosenCard = sly; chosenTarget = { targetPlayerId: bestOpp.id, color: bestColor, cardId: bestCardId }; }
      }
    }

    // 6. Forced Deal — swap a low-priority card for one that helps build our sets
    if (!chosenCard) {
      const fd = acts.find(c => c.actionType === 'forceddeal');
      if (fd) {
        const sortedOthers = [...others].sort((a, b) => playerThreatScore(b) - playerThreatScore(a));
        let bestDeal: Record<string, unknown> | null = null;
        let bestDealScore = -1;
        for (const opp of sortedOthers) {
          for (const theirSet of opp.properties.filter(s => !s.isComplete && s.cards.length > 0)) {
            const myMatchSet = player.properties.find(p => p.color === theirSet.color);
            if (myMatchSet?.isComplete) continue;
            const req = PROPERTY_SET_REQUIREMENTS[theirSet.color] ?? 3;
            const gain = ((myMatchSet?.cards.length ?? 0) + 1) / req;
            // Give from our least-progressed incomplete set
            const myGiveSets = player.properties
              .filter(s => !s.isComplete && s.cards.length > 0 && s.color !== theirSet.color)
              .sort((a, b) => (a.cards.length / (PROPERTY_SET_REQUIREMENTS[a.color] ?? 3)) - (b.cards.length / (PROPERTY_SET_REQUIREMENTS[b.color] ?? 3)));
            const myGiveSet = myGiveSets[0];
            if (!myGiveSet) continue;
            for (const theirCard of theirSet.cards) {
              const myCard = myGiveSet.cards[0];
              const score = gain - myCard.value / 20;
              if (score > bestDealScore) {
                bestDealScore = score;
                bestDeal = { targetPlayerId: opp.id, theirColor: theirSet.color, theirCardId: theirCard.id, myColor: myGiveSet.color, myCardId: myCard.id };
              }
            }
          }
        }
        if (bestDeal) { chosenCard = fd; chosenTarget = bestDeal; }
      }
    }

    // 7. Properties — human-like caution: don't expose isolated single cards
    if (!chosenCard && props.length > 0) {
      const sorted = [...props].sort((a, b) => {
        const ac = (a.type === 'wild' && a.colors?.length ? aiBestColorForWild(player, a) : a.color) as PropertyColor;
        const bc = (b.type === 'wild' && b.colors?.length ? aiBestColorForWild(player, b) : b.color) as PropertyColor;
        const aSet = player.properties.find(p => p.color === ac);
        const bSet = player.properties.find(p => p.color === bc);
        const aReq = PROPERTY_SET_REQUIREMENTS[ac] ?? 3;
        const bReq = PROPERTY_SET_REQUIREMENTS[bc] ?? 3;
        return (((bSet?.cards.length ?? 0) + 1) / bReq) - (((aSet?.cards.length ?? 0) + 1) / aReq);
      });
      for (const card of sorted) {
        const color = (card.type === 'wild' && card.colors?.length
          ? aiBestColorForWild(player, card)
          : card.color) as PropertyColor;
        if (!color) continue;
        const set = player.properties.find(p => p.color === color);
        const onTable = (set?.cards.length ?? 0) > 0;
        if (card.type === 'wild') {
          // Wildcards: only expose when building on an existing set, or have JSN protection
          if (onTable || hasJsn) { chosenCard = card; chosenTarget = { color }; break; }
        } else {
          // Regular property: only expose if already building this color, have another of same color in hand, or have JSN
          const sameColorInHand = props.some(c => c.type === 'property' && c.color === color && c.id !== card.id);
          if (onTable || sameColorInHand || hasJsn) { chosenCard = card; chosenTarget = { color }; break; }
        }
      }
    }

    // 8. Rent — charge when it's worth it
    if (!chosenCard && rents.length > 0) {
      const drCard = skill === 'advanced' ? player.hand.find(c => c.actionType === 'doublerent') : undefined;
      let bestRentCard: Card | null = null, bestRentColor: PropertyColor | null = null, bestRent = 0;
      for (const rc of rents) {
        const colors: PropertyColor[] = (rc.rentColors && rc.rentColors.length > 0)
          ? rc.rentColors.filter(col => (player.properties.find(p => p.color === col)?.cards.length ?? 0) > 0)
          : player.properties.filter(s => s.cards.length > 0).map(s => s.color);
        for (const col of colors) {
          const r = calculateRent(player, col, !!drCard);
          if (r > bestRent) { bestRent = r; bestRentColor = col; bestRentCard = rc; }
        }
      }
      if (bestRentCard && bestRentColor && (bestRent >= 3 || mySets >= 1)) {
        chosenCard = bestRentCard; chosenTarget = { color: bestRentColor, drCard };
      }
    }

    // 9. Birthday / Debt Collector
    if (!chosenCard) {
      const bday = acts.find(c => c.actionType === 'birthday');
      if (bday && others.some(p => p.bank.length > 0 || p.properties.some(s => s.cards.length > 0))) {
        chosenCard = bday;
      }
    }
    if (!chosenCard) {
      const dc = acts.find(c => c.actionType === 'debtcollector');
      if (dc && others.length > 0) {
        const target = others.reduce((b, p) =>
          p.bank.reduce((s, c) => s + c.value, 0) > b.bank.reduce((s, c) => s + c.value, 0) ? p : b, others[0]);
        chosenCard = dc; chosenTarget = { targetPlayerId: target.id };
      }
    }

    // 10. PassGo any time
    if (!chosenCard) {
      const passgo = acts.find(c => c.actionType === 'passgo');
      if (passgo) chosenCard = passgo;
    }

    // 11. Small cash (< 4M)
    if (!chosenCard && cash.length > 0) {
      const small = cash.filter(c => c.value < 4).sort((a, b) => a.value - b.value);
      if (small.length > 0) chosenCard = small[0];
    }

    // 12. Any remaining action we can discard as cash
    if (!chosenCard && acts.length > 0) chosenCard = acts[0];

    // 13. Any remaining cash
    if (!chosenCard && cash.length > 0) {
      chosenCard = [...cash].sort((a, b) => a.value - b.value)[0];
    }

    if (!chosenCard) break;

    const idx = player.hand.findIndex(c => c.id === chosenCard!.id);
    if (idx === -1) break;
    player.hand.splice(idx, 1);

    if (chosenCard.type === 'property' || chosenCard.type === 'wild') {
      const color = ((chosenTarget?.color as PropertyColor) || (chosenCard.type === 'wild' && chosenCard.colors?.length ? aiBestColorForWild(player, chosenCard) : chosenCard.color)) as PropertyColor | undefined;
      if (color) {
        chosenCard.color = color;
        const set = player.properties.find(p => p.color === color);
        if (set && !set.isComplete) { set.cards.push(chosenCard); set.isComplete = checkPropertySetComplete(set); }
        else { player.hand.push(chosenCard); break; } // target set full — keep in hand, stop planning
      }
    } else if (chosenCard.type === 'cash') {
      player.bank.push(chosenCard);
    } else if (chosenCard.type === 'rent') {
      room.discardPile.push(chosenCard);
      const rentColor = chosenTarget?.color as PropertyColor | undefined;
      if (rentColor) {
        // Advanced AI: use Double Rent if selected
        let doubled = room.doubleRentActive;
        room.doubleRentActive = false;
        if (skill === 'advanced' && chosenTarget?.drCard) {
          const dr = chosenTarget.drCard as Card;
          const drIdx = player.hand.findIndex(c => c.id === dr.id);
          if (drIdx !== -1) {
            const [drCard] = player.hand.splice(drIdx, 1);
            room.discardPile.push(drCard);
            doubled = true;
          }
        }
        const rent = calculateRent(player, rentColor, doubled);
        requestPayments(room, roomId, player, others, rent, 'rent');
      }
      played++;
      if (room.pendingPayments.length > 0) break;
      continue;
    } else {
      handleActionCard(room, roomId, player, chosenCard, chosenTarget);
      played++;
      if (room.pendingPayments.length > 0 || room.pendingActions.length > 0) break;
      continue;
    }

    played++;
  }

  // Discard down to 7 at end of turn (rule §4.5) — lowest-priority cards first
  if (player.hand.length > 7) {
    player.hand.sort((a, b) => aiDiscardPriority(a) - aiDiscardPriority(b));
    while (player.hand.length > 7) room.discardPile.push(player.hand.shift()!);
  }
  player.cardsPlayedThisTurn = 0;
  advanceTurn(room, roomId);
}

// ─── Advance Turn ────────────────────────────────────────────────────────────

function advanceTurn(room: GameRoom, roomId: string) {
  // Don't advance if human payments or pending actions (e.g. Deal Breaker JSN) are still pending
  if (room.pendingPayments.length > 0) return;
  if (room.pendingActions.length > 0) return;

  const player = room.players[room.currentPlayerIndex];
  if (!player) return;
  player.cardsPlayedThisTurn = 0;
  player.hadZeroCardsAtEnd = player.hand.length === 0;
  room.doubleRentActive = false;
  room.timerPaused = false;
  room.turnElapsedBeforePause = 0;
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  room.turnPhase = 'draw';
  room.turnStartedAt = Date.now();

  io.to(roomId).emit('turn-ended', { room, nextPlayer: room.players[room.currentPlayerIndex] });

  startTurnTimer(roomId, room);

  const next = room.players[room.currentPlayerIndex];
  if (next.isAI) setTimeout(() => processAITurn(room, next), 2000);
}

// ─── Action Executors ─────────────────────────────────────────────────────────

function executeDealBreaker(room: GameRoom, action: PendingAction): void {
  const actor = room.players.find(p => p.id === action.actorId);
  const target = room.players.find(p => p.id === action.targetId);
  if (!actor || !target) return;
  const targetSet = target.properties.find(p => p.color === action.targetData?.color);
  const mySet = actor.properties.find(p => p.color === action.targetData?.color);
  if (targetSet?.isComplete && mySet) {
    mySet.cards.push(...targetSet.cards);
    mySet.hasHouse = targetSet.hasHouse; mySet.houseCard = targetSet.houseCard;
    mySet.hasHotel = targetSet.hasHotel; mySet.hotelCard = targetSet.hotelCard;
    mySet.isComplete = true;
    targetSet.cards = []; targetSet.hasHouse = false; targetSet.hasHotel = false;
    targetSet.houseCard = undefined; targetSet.hotelCard = undefined; targetSet.isComplete = false;
    if (target.socketId) {
      io.to(target.socketId).emit('card-taken', {
        takerName: actor.name,
        cardName: (action.targetData?.color ?? '') + ' complete set',
        color: action.targetData?.color,
        dealType: 'dealbreaker',
      });
    }
  }
}

function executeSlyDeal(room: GameRoom, action: PendingAction): void {
  const actor = room.players.find(p => p.id === action.actorId);
  const target = room.players.find(p => p.id === action.targetId);
  if (!actor || !target) return;
  const targetSet = target.properties.find(p => p.color === action.targetData?.color);
  if (targetSet && !targetSet.isComplete) {
    const ci = targetSet.cards.findIndex(c => c.id === action.targetData?.cardId);
    if (ci !== -1) {
      const [stolen] = targetSet.cards.splice(ci, 1);
      targetSet.isComplete = checkPropertySetComplete(targetSet);
      const mySet = actor.properties.find(p => p.color === action.targetData?.color);
      if (mySet) { mySet.cards.push(stolen); mySet.isComplete = checkPropertySetComplete(mySet); }
      if (target.socketId) {
        io.to(target.socketId).emit('card-taken', {
          takerName: actor.name, cardName: stolen.name,
          color: action.targetData?.color, dealType: 'slydeal',
        });
      }
    }
  }
}

function executeForcedDeal(room: GameRoom, action: PendingAction): void {
  const actor = room.players.find(p => p.id === action.actorId);
  const target = room.players.find(p => p.id === action.targetId);
  if (!actor || !target) return;
  const mySet = actor.properties.find(p => p.color === action.targetData?.myColor);
  const theirSet = target.properties.find(p => p.color === action.targetData?.theirColor);
  if (mySet && theirSet && !theirSet.isComplete) {
    const myCI = mySet.cards.findIndex(c => c.id === action.targetData?.myCardId);
    const theirCI = theirSet.cards.findIndex(c => c.id === action.targetData?.theirCardId);
    if (myCI !== -1 && theirCI !== -1) {
      const [myCard] = mySet.cards.splice(myCI, 1);
      const [theirCard] = theirSet.cards.splice(theirCI, 1);
      mySet.isComplete = checkPropertySetComplete(mySet);
      theirSet.isComplete = checkPropertySetComplete(theirSet);
      const myCardDest = target.properties.find(p => p.color === myCard.color);
      if (myCardDest) { myCardDest.cards.push(myCard); myCardDest.isComplete = checkPropertySetComplete(myCardDest); }
      const theirCardDest = actor.properties.find(p => p.color === theirCard.color);
      if (theirCardDest) { theirCardDest.cards.push(theirCard); theirCardDest.isComplete = checkPropertySetComplete(theirCardDest); }
      if (target.socketId) {
        io.to(target.socketId).emit('card-taken', {
          takerName: actor.name, cardName: theirCard.name,
          color: theirCard.color, dealType: 'forceddeal',
        });
      }
    }
  }
}

function resolveAction(room: GameRoom, roomId: string, action: PendingAction): void {
  // Clear any pending timer for this action
  const t = actionTimers.get(action.id);
  if (t) { clearTimeout(t); actionTimers.delete(action.id); }

  // Execute if jsnCount is even (action wins), skip if odd (JSN wins)
  if (action.jsnCount % 2 === 0) {
    if (action.type === 'dealbreaker') executeDealBreaker(room, action);
    else if (action.type === 'slydeal') executeSlyDeal(room, action);
    else if (action.type === 'forceddeal') executeForcedDeal(room, action);
  }

  room.pendingActions = room.pendingActions.filter(a => a.id !== action.id);

  const winner = checkWinner(room);
  if (winner) {
    room.winner = winner; room.phase = 'ended';
    clearTurnTimer(roomId);
    io.to(roomId).emit('game-ended', { room, winner });
    return;
  }

  io.to(roomId).emit('room-updated', { room });

  // Advance AI turn if it was stalled waiting
  if (room.pendingPayments.length === 0 && room.pendingActions.length === 0) {
    const activePlayer = room.players[room.currentPlayerIndex];
    if (activePlayer?.isAI) advanceTurn(room, roomId);
  }
}

// ─── Action Card Handler ─────────────────────────────────────────────────────

/** Auto-play JSN for an AI defender. Splices JSN from hand, discards it, and notifies the actor. Returns true if action was blocked. */
function aiAutoPlayJsn(room: GameRoom, roomId: string, actor: Player, aiTarget: Player, actionLabel: string): boolean {
  const jsnIdx = aiTarget.hand.findIndex(c => c.actionType === 'sayno');
  if (jsnIdx === -1) return false;
  const [jsn] = aiTarget.hand.splice(jsnIdx, 1);
  room.discardPile.push(jsn);
  if (!aiTarget.powerCardStats) aiTarget.powerCardStats = {};
  aiTarget.powerCardStats.sayno = (aiTarget.powerCardStats.sayno ?? 0) + 1;
  if (actor.socketId) io.to(actor.socketId).emit('jsn-notification', {
    message: `${aiTarget.name} blocked your ${actionLabel} with Just Say No!`,
  });
  io.to(roomId).emit('room-updated', { room });
  return true;
}

function handleActionCard(room: GameRoom, roomId: string, player: Player, card: Card, targetData?: any): void {
  // House and Hotel cards stay on the table with their set — do NOT discard them here
  const isImprovement = card.actionType === 'house' || card.actionType === 'hotel';
  if (!isImprovement) room.discardPile.push(card);
  // Track power card usage for end-game transparency
  if (card.actionType && ['dealbreaker', 'slydeal', 'forceddeal', 'birthday', 'debtcollector'].includes(card.actionType)) {
    if (!player.powerCardStats) player.powerCardStats = {};
    player.powerCardStats[card.actionType] = (player.powerCardStats[card.actionType] ?? 0) + 1;
  }

  switch (card.actionType) {
    case 'passgo': {
      const extra = safeDraw(room, 2, roomId);
      player.hand.push(...extra);
      break;
    }

    case 'doublerent': {
      // Mark double-rent active; the rent card played next (or prev) this turn uses it
      room.doubleRentActive = true;
      break;
    }

    case 'debtcollector': {
      const target = room.players.find(p => p.id === targetData?.targetPlayerId);
      if (target && target.id !== player.id) {
        requestPayments(room, roomId, player, [target], 5, 'debtcollector');
      }
      break;
    }

    case 'birthday': {
      const opponents = room.players.filter(p => p.id !== player.id);
      requestPayments(room, roomId, player, opponents, 2, 'birthday');
      break;
    }

    case 'dealbreaker': {
      const targetPlayer = room.players.find(p => p.id === targetData?.targetPlayerId);
      if (targetPlayer && !targetPlayer.isAI) {
        // Check if target has a Just Say No
        const hasJsn = targetPlayer.hand.some(c => c.actionType === 'sayno');
        if (hasJsn) {
          // Create a pending action and wait for target's response
          const pendingAction: PendingAction = {
            id: uuidv4(),
            type: 'dealbreaker',
            actorId: player.id,
            targetId: targetPlayer.id,
            targetData,
            cardId: card.id,
            responderId: targetPlayer.id,
            jsnCount: 0,
          };
          room.pendingActions.push(pendingAction);

          // Notify the target
          io.to(targetPlayer.socketId).emit('deal-breaker-request', {
            actionId: pendingAction.id,
            actorName: player.name,
            color: targetData?.color,
            room,
          });

          // Auto-accept after 15 seconds if no response
          const timer = setTimeout(() => {
            const r = rooms.get(roomId);
            if (!r) return;
            const a = r.pendingActions.find(x => x.id === pendingAction.id);
            if (a) resolveAction(r, roomId, a);
          }, 15000);
          actionTimers.set(pendingAction.id, timer);
          return; // Return from handleActionCard; play-card outer handler still increments cardsPlayedThisTurn
        }
      }
      // AI target: always block Deal Breaker with JSN (never give away a complete set for free)
      if (targetPlayer?.isAI && aiAutoPlayJsn(room, roomId, player, targetPlayer, 'Deal Breaker')) break;
      // No JSN — execute immediately
      if (targetPlayer) {
        const targetSet = targetPlayer.properties.find(p => p.color === targetData?.color);
        const mySet = player.properties.find(p => p.color === targetData?.color);
        if (targetSet?.isComplete && mySet) {
          mySet.cards.push(...targetSet.cards);
          mySet.hasHouse = targetSet.hasHouse; mySet.houseCard = targetSet.houseCard;
          mySet.hasHotel = targetSet.hasHotel; mySet.hotelCard = targetSet.hotelCard;
          mySet.isComplete = true;
          targetSet.cards = []; targetSet.hasHouse = false; targetSet.hasHotel = false;
          targetSet.houseCard = undefined; targetSet.hotelCard = undefined; targetSet.isComplete = false;
          if (targetPlayer.socketId) {
            io.to(targetPlayer.socketId).emit('card-taken', {
              takerName: player.name,
              cardName: (targetData?.color ?? '') + ' complete set',
              color: targetData?.color,
              dealType: 'dealbreaker',
            });
          }
        }
      }
      break;
    }

    case 'slydeal': {
      const targetPlayer = room.players.find(p => p.id === targetData?.targetPlayerId);
      if (targetPlayer && !targetPlayer.isAI) {
        const hasJsn = targetPlayer.hand.some(c => c.actionType === 'sayno');
        if (hasJsn) {
          const pendingAction: PendingAction = {
            id: uuidv4(), type: 'slydeal',
            actorId: player.id, targetId: targetPlayer.id,
            targetData, cardId: card.id,
            responderId: targetPlayer.id, jsnCount: 0,
          };
          room.pendingActions.push(pendingAction);
          io.to(targetPlayer.socketId).emit('deal-breaker-request', {
            actionId: pendingAction.id, actorName: player.name,
            color: targetData?.color, room,
          });
          const timer = setTimeout(() => {
            const r = rooms.get(roomId);
            if (!r) return;
            const a = r.pendingActions.find(x => x.id === pendingAction.id);
            if (a) resolveAction(r, roomId, a);
          }, 15000);
          actionTimers.set(pendingAction.id, timer);
          return;
        }
      }
      // AI target: use JSN if protecting a set with meaningful investment (≥2 cards)
      if (targetPlayer?.isAI) {
        const aiSlySet = targetPlayer.properties.find(p => p.color === targetData?.color);
        if (aiSlySet && aiSlySet.cards.length >= 2 && aiAutoPlayJsn(room, roomId, player, targetPlayer, 'Sly Deal')) break;
      }
      // Execute immediately (AI target with small set, or no JSN in hand)
      if (targetPlayer) {
        const targetSet = targetPlayer.properties.find(p => p.color === targetData?.color);
        if (targetSet && !targetSet.isComplete) {
          const ci = targetSet.cards.findIndex(c => c.id === targetData?.cardId);
          if (ci !== -1) {
            const [stolen] = targetSet.cards.splice(ci, 1);
            targetSet.isComplete = checkPropertySetComplete(targetSet);
            const mySet = player.properties.find(p => p.color === targetData?.color);
            if (mySet) { mySet.cards.push(stolen); mySet.isComplete = checkPropertySetComplete(mySet); }
            if (targetPlayer.socketId) {
              io.to(targetPlayer.socketId).emit('card-taken', {
                takerName: player.name, cardName: stolen.name,
                color: targetData?.color, dealType: 'slydeal',
              });
            }
          }
        }
      }
      break;
    }

    case 'forceddeal': {
      const targetPlayer = room.players.find(p => p.id === targetData?.targetPlayerId);
      if (targetPlayer && !targetPlayer.isAI) {
        const hasJsn = targetPlayer.hand.some(c => c.actionType === 'sayno');
        if (hasJsn) {
          const pendingAction: PendingAction = {
            id: uuidv4(), type: 'forceddeal',
            actorId: player.id, targetId: targetPlayer.id,
            targetData, cardId: card.id,
            responderId: targetPlayer.id, jsnCount: 0,
          };
          room.pendingActions.push(pendingAction);
          io.to(targetPlayer.socketId).emit('deal-breaker-request', {
            actionId: pendingAction.id, actorName: player.name,
            color: targetData?.theirColor, room,
          });
          const timer = setTimeout(() => {
            const r = rooms.get(roomId);
            if (!r) return;
            const a = r.pendingActions.find(x => x.id === pendingAction.id);
            if (a) resolveAction(r, roomId, a);
          }, 15000);
          actionTimers.set(pendingAction.id, timer);
          return;
        }
      }
      // AI target: use JSN if protecting a set with meaningful investment (≥2 cards)
      if (targetPlayer?.isAI) {
        const aiFdSet = targetPlayer.properties.find(p => p.color === targetData?.theirColor);
        if (aiFdSet && aiFdSet.cards.length >= 2 && aiAutoPlayJsn(room, roomId, player, targetPlayer, 'Forced Deal')) break;
      }
      // Execute immediately
      if (targetPlayer) {
        const mySet = player.properties.find(p => p.color === targetData?.myColor);
        const theirSet = targetPlayer.properties.find(p => p.color === targetData?.theirColor);
        if (mySet && theirSet && !theirSet.isComplete) {
          const myCI = mySet.cards.findIndex(c => c.id === targetData?.myCardId);
          const theirCI = theirSet.cards.findIndex(c => c.id === targetData?.theirCardId);
          if (myCI !== -1 && theirCI !== -1) {
            const [myCard] = mySet.cards.splice(myCI, 1);
            const [theirCard] = theirSet.cards.splice(theirCI, 1);
            mySet.isComplete = checkPropertySetComplete(mySet);
            theirSet.isComplete = checkPropertySetComplete(theirSet);
            const myCardDest = targetPlayer.properties.find(p => p.color === myCard.color);
            if (myCardDest) { myCardDest.cards.push(myCard); myCardDest.isComplete = checkPropertySetComplete(myCardDest); }
            const theirCardDest = player.properties.find(p => p.color === theirCard.color);
            if (theirCardDest) { theirCardDest.cards.push(theirCard); theirCardDest.isComplete = checkPropertySetComplete(theirCardDest); }
            if (targetPlayer.socketId) {
              io.to(targetPlayer.socketId).emit('card-taken', {
                takerName: player.name, cardName: theirCard.name,
                color: theirCard.color, dealType: 'forceddeal',
              });
            }
          }
        }
      }
      break;
    }

    case 'house': {
      if (targetData?.color) {
        const color = targetData.color as PropertyColor;
        // Railroads (black) and Utilities cannot have Houses/Hotels (spec §8.2)
        if (color !== 'black' && color !== 'utility') {
          const set = player.properties.find(p => p.color === color);
          if (set?.isComplete && !set.hasHouse) {
            set.hasHouse = true;
            set.houseCard = card; // card stays on the table
          } else {
            room.discardPile.push(card); // invalid target — discard
          }
        } else {
          room.discardPile.push(card);
        }
      } else {
        room.discardPile.push(card);
      }
      break;
    }

    case 'hotel': {
      if (targetData?.color) {
        const color = targetData.color as PropertyColor;
        if (color !== 'black' && color !== 'utility') {
          const set = player.properties.find(p => p.color === color);
          if (set?.isComplete && set.hasHouse && !set.hasHotel) {
            set.hasHotel = true;
            set.hotelCard = card; // card stays on the table
            // Per rules: house card returns to supply when hotel is added
            if (set.houseCard) { room.discardPile.push(set.houseCard); set.houseCard = undefined; }
          } else {
            room.discardPile.push(card);
          }
        } else {
          room.discardPile.push(card);
        }
      } else {
        room.discardPile.push(card);
      }
      break;
    }
  }
}

// ─── Socket.IO ───────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('create-room', ({ playerName, version, mode, aiCount, turnTimeLimit, persistentPlayerId, aiSkillLevel }: {
    playerName: string; version: string; mode: 'single' | 'multi'; aiCount?: number; turnTimeLimit?: number; persistentPlayerId?: string; aiSkillLevel?: AISkillLevel;
  }) => {
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    const player = createPlayer(playerName, socket.id, true, false, persistentPlayerId);
    const roomPlayers: Player[] = [player];
    const skill: AISkillLevel = aiSkillLevel ?? 'medium';

    if (mode === 'single' && aiCount) {
      for (let i = 0; i < aiCount; i++) {
        roomPlayers.push(createPlayer(`${pickAIName(roomPlayers)} (AI)`, `ai-${i}`, false, true, undefined, skill));
      }
    }

    const room: GameRoom = {
      id: roomId, hostId: player.id, players: roomPlayers, spectators: [],
      version: version as GameVersion, phase: 'lobby',
      deck: generateDeck(version as GameVersion), discardPile: [],
      currentPlayerIndex: 0, turnPhase: 'draw', winner: null,
      createdAt: Date.now(), mode,
      pendingPayments: [], pendingActions: [], doubleRentActive: false,
      turnTimeLimit: turnTimeLimit ?? 60,
      turnStartedAt: 0,
      timerPaused: false,
      turnElapsedBeforePause: 0,
      aiSkillLevel: skill,
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('room-created', { room, player });

    if (mode === 'single') {
      setTimeout(() => {
        room.phase = 'playing'; room.currentPlayerIndex = 0; room.turnPhase = 'draw';
        room.turnStartedAt = Date.now();
        dealInitialCards(room);
        io.to(roomId).emit('game-started', { room });
        startTurnTimer(roomId, room);
      }, 1000);
    }
  });

  socket.on('join-room', ({ roomId, playerName, persistentPlayerId }: { roomId: string; playerName: string; persistentPlayerId?: string }) => {
    const upperRoomId = roomId.toUpperCase();
    const room = rooms.get(upperRoomId);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

    // Allow reconnect: find the existing player by persistentPlayerId
    if (persistentPlayerId) {
      const existingPlayer = room.players.find(p => p.persistentPlayerId === persistentPlayerId);
      if (existingPlayer) {
        // Clear any pending disconnect removal timer
        const dtKey = `${upperRoomId}:${existingPlayer.id}`;
        const dt = disconnectTimers.get(dtKey);
        if (dt) { clearTimeout(dt); disconnectTimers.delete(dtKey); }

        existingPlayer.socketId = socket.id;
        existingPlayer.disconnected = false;
        socket.join(upperRoomId);
        socket.emit('room-joined', { room, player: existingPlayer });
        socket.to(upperRoomId).emit('player-reconnected', { player: existingPlayer, room });
        return;
      }
    }

    if (room.phase !== 'lobby')   { socket.emit('error', { message: 'Game already in progress' }); return; }
    if (room.players.length >= 5) { socket.emit('error', { message: 'Room is full' }); return; }

    const player = createPlayer(playerName, socket.id, false, false, persistentPlayerId);
    room.players.push(player);
    socket.join(upperRoomId);
    socket.emit('room-joined', { room, player });
    socket.to(upperRoomId).emit('player-joined', { player, room });
  });

  // Explicit reconnect-room event (used on page refresh / auto-reconnect)
  socket.on('reconnect-room', ({ roomId, persistentPlayerId }: { roomId: string; persistentPlayerId: string }) => {
    const upperRoomId = roomId.toUpperCase();
    const room = rooms.get(upperRoomId);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

    const existingPlayer = room.players.find(p => p.persistentPlayerId === persistentPlayerId);
    if (!existingPlayer) { socket.emit('error', { message: 'Player not found in room' }); return; }

    // Clear pending removal timer
    const dtKey = `${upperRoomId}:${existingPlayer.id}`;
    const dt = disconnectTimers.get(dtKey);
    if (dt) { clearTimeout(dt); disconnectTimers.delete(dtKey); }

    existingPlayer.socketId = socket.id;
    existingPlayer.disconnected = false;
    socket.join(upperRoomId);
    socket.emit('reconnected', { room, player: existingPlayer });
    socket.to(upperRoomId).emit('player-reconnected', { player: existingPlayer, room });

    // Re-send any pending payment-request that was missed while disconnected
    const missedPayment = room.pendingPayments.find(
      p => p.debtorId === existingPlayer.id && !p.jsnState
    );
    if (missedPayment) {
      const creditor = room.players.find(p => p.id === missedPayment.creditorId);
      socket.emit('payment-request', {
        paymentId: missedPayment.id,
        creditorId: missedPayment.creditorId,
        creditorName: creditor?.name ?? '',
        amount: missedPayment.amount,
        reason: missedPayment.reason,
        room,
      });
    }
  });

  // Watch a room as spectator
  socket.on('watch-room', ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    const upperRoomId = roomId.toUpperCase();
    const room = rooms.get(upperRoomId);
    if (!room) { socket.emit('error', { message: 'Room not found' }); return; }

    const spectator: Spectator = { id: uuidv4(), name: playerName, socketId: socket.id };
    room.spectators.push(spectator);
    socket.join(upperRoomId);
    socket.emit('room-watched', { room, spectator });
    socket.to(upperRoomId).emit('spectator-joined', { spectator, room });
  });

  socket.on('add-ai-player', ({ roomId, playerId, aiSkillLevel }: { roomId: string; playerId: string; aiSkillLevel?: AISkillLevel }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.hostId !== playerId) { socket.emit('error', { message: 'Only host can add AI players' }); return; }
    if (room.players.length >= 5) { socket.emit('error', { message: 'Room is full' }); return; }
    const skill: AISkillLevel = aiSkillLevel ?? room.aiSkillLevel ?? 'medium';
    const ai = createPlayer(`${pickAIName(room.players)} (AI)`, `ai-${Date.now()}`, false, true, undefined, skill);
    room.players.push(ai);
    io.to(roomId).emit('player-joined', { player: ai, room });
  });

  socket.on('remove-ai-player', ({ roomId, playerId, aiPlayerId }: { roomId: string; playerId: string; aiPlayerId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.hostId !== playerId) { socket.emit('error', { message: 'Only host can remove AI players' }); return; }
    const idx = room.players.findIndex(p => p.id === aiPlayerId && p.isAI);
    if (idx === -1) { socket.emit('error', { message: 'AI player not found' }); return; }
    const [ai] = room.players.splice(idx, 1);
    io.to(roomId).emit('player-left', { player: ai, room });
  });

  socket.on('player-ready', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId);
    if (player) { player.isReady = true; io.to(roomId).emit('player-updated', { player, room }); }
  });

  socket.on('start-game', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.players.length < 2) { socket.emit('error', { message: 'Need at least 2 players' }); return; }
    room.phase = 'playing'; room.currentPlayerIndex = 0; room.turnPhase = 'draw';
    room.turnStartedAt = Date.now();
    dealInitialCards(room);
    io.to(roomId).emit('game-started', { room });
    startTurnTimer(roomId, room);
  });

  // ── Draw cards (spec §5.2: draw 5 if had 0 at end of last turn) ──
  socket.on('draw-cards', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players[room.currentPlayerIndex];
    if (player.id !== playerId || room.turnPhase !== 'draw') return;

    const count = player.hadZeroCardsAtEnd ? 5 : 2;
    player.hadZeroCardsAtEnd = false;
    const drawn = safeDraw(room, count, roomId);
    player.hand.push(...drawn);
    room.turnPhase = 'play';

    io.to(roomId).emit('cards-drawn', { player, cards: drawn, room });
  });

  // ── Play card ──
  socket.on('play-card', ({ roomId, playerId, cardId, targetData }: {
    roomId: string; playerId: string; cardId: string; targetData?: any;
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[room.currentPlayerIndex];
    if (player.id !== playerId || room.turnPhase !== 'play') return;

    // Double Rent is a free modifier — check BEFORE removing card so we can peek at its type
    const peekCard = player.hand.find(c => c.id === cardId);
    const isDoubleRentCard = peekCard?.type === 'action' && (peekCard as any).actionType === 'doublerent';

    if (player.cardsPlayedThisTurn >= 3 && !isDoubleRentCard) {
      socket.emit('error', { message: 'You can only play 3 cards per turn' });
      return;
    }

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const card = player.hand.splice(cardIndex, 1)[0];

    // Bank any card as cash (spec §5.3: "bank a card")
    if (targetData?.bankAsCard) {
      player.bank.push(card);
      player.cardsPlayedThisTurn++;
      const winner = checkWinner(room);
      if (winner) { room.winner = winner; room.phase = 'ended'; clearTurnTimer(roomId); io.to(roomId).emit('game-ended', { room, winner }); return; }
      io.to(roomId).emit('card-played', { player, card, room, targetData });
      return;
    }

    switch (card.type) {
      case 'property':
      case 'wild': {
        const color = (targetData?.color || card.color) as PropertyColor;
        if (color) {
          const propSet = player.properties.find(p => p.color === color);
          if (propSet?.isComplete) {
            // Set is already complete — reject play, put card back in hand
            player.hand.push(card);
            socket.emit('error', { message: 'That property set is already complete' });
            return;
          }
          card.color = color; // keep card.color in sync with the set it lives in
          if (propSet) { propSet.cards.push(card); propSet.isComplete = checkPropertySetComplete(propSet); }
        }
        break;
      }

      case 'cash':
        player.bank.push(card);
        break;

      case 'action':
        handleActionCard(room, roomId, player, card, targetData);
        break;

      case 'rent': {
        const rentColor = targetData?.color as PropertyColor;
        if (!rentColor) { room.discardPile.push(card); break; }

        // Support inline Double Rent: when submitted together with a Rent card from the modal
        let doubled = room.doubleRentActive;
        room.doubleRentActive = false; // consume any standalone doublerent that was pre-played

        if (targetData?.useDoubleRent && targetData?.doubleRentCardId) {
          const drIdx = player.hand.findIndex((c: Card) => c.id === targetData.doubleRentCardId);
          if (drIdx !== -1) {
            const [drCard] = player.hand.splice(drIdx, 1);
            room.discardPile.push(drCard);
            doubled = true;
            // Double Rent is free — does NOT consume one of the 3 plays
          }
        }

        const rent = calculateRent(player, rentColor, doubled);
        room.discardPile.push(card);

        // Wild rent (no rentColors) targets one player; two-color targets all opponents
        const isWild = !card.rentColors || card.rentColors.length === 0;
        const opponents = room.players.filter(p => p.id !== player.id);
        const targets = isWild && targetData?.targetPlayerId
          ? opponents.filter(p => p.id === targetData.targetPlayerId)
          : opponents;

        if (rent > 0) requestPayments(room, roomId, player, targets, rent, 'rent');
        break;
      }
    }

    // Double Rent is a free modifier card — it does not consume one of the 3 plays per turn
    if (!isDoubleRentCard) {
      player.cardsPlayedThisTurn++;
    }

    const winner = checkWinner(room);
    if (winner) {
      room.winner = winner; room.phase = 'ended';
      clearTurnTimer(roomId);
      io.to(roomId).emit('game-ended', { room, winner });
      return;
    }

    io.to(roomId).emit('card-played', { player, card, room, targetData });
  });

  // ── Pay amount (spec §6) ──
  socket.on('pay-amount', ({ roomId, paymentId, bankCardIds, propertyCards }: {
    roomId: string;
    paymentId: string;
    bankCardIds: string[];
    propertyCards: { color: PropertyColor; cardId: string }[];
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const payment = room.pendingPayments.find(p => p.id === paymentId);
    if (!payment) return;

    // Auth: paymentId UUID was only sent to the debtor — no socketId check needed
    // (socketId check breaks when player briefly reconnects before socketId is updated)
    const debtor = room.players.find(p => p.id === payment.debtorId);
    if (!debtor) return;

    processPayment(room, payment, bankCardIds, propertyCards);
    room.pendingPayments = room.pendingPayments.filter(p => p.id !== paymentId);

    const winner = checkWinner(room);
    if (winner) {
      room.winner = winner; room.phase = 'ended';
      clearTurnTimer(roomId);
      io.to(roomId).emit('game-ended', { room, winner });
      return;
    }

    io.to(roomId).emit('payment-made', { room });

    if (room.pendingPayments.length === 0) {
      resumeTurnTimer(roomId, room);
      io.to(roomId).emit('all-payments-done', { room });
      // If it was an AI's turn that stalled waiting for human payments, advance now
      const activePlayer = room.players[room.currentPlayerIndex];
      if (activePlayer?.isAI) advanceTurn(room, roomId);
    }
  });

  // ── Just Say No (spec §8.1 #7) ──
  socket.on('just-say-no', ({ roomId, paymentId, cardId }: {
    roomId: string; paymentId: string; cardId: string;
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const payment = room.pendingPayments.find(p => p.id === paymentId);
    if (!payment) return;

    // Auth: paymentId UUID was only sent to the debtor
    const debtor = room.players.find(p => p.id === payment.debtorId);
    if (!debtor) return;

    const jsnIdx = debtor.hand.findIndex(c => c.id === cardId && c.actionType === 'sayno');
    if (jsnIdx === -1) { socket.emit('error', { message: 'Just Say No card not found in hand' }); return; }

    const [jsn] = debtor.hand.splice(jsnIdx, 1);
    room.discardPile.push(jsn);
    if (!debtor.powerCardStats) debtor.powerCardStats = {};
    debtor.powerCardStats.sayno = (debtor.powerCardStats.sayno ?? 0) + 1;

    // Check if creditor has a JSN to counter
    const creditor = room.players.find(p => p.id === payment.creditorId);
    const creditorHasJsn = creditor && !creditor.isAI && creditor.hand.some(c => c.actionType === 'sayno');

    if (creditorHasJsn && creditor) {
      // Give creditor a 10-second window to counter
      payment.jsnState = { awaitingCounterFromId: creditor.id, jsnCount: 1 };
      io.to(creditor.socketId).emit('jsn-counter-opportunity', {
        paymentId,
        debtorName: debtor.name,
        room,
      });
      // Broadcast updated room so debtor sees "waiting"
      io.to(roomId).emit('room-updated', { room });

      const timer = setTimeout(() => {
        const r = rooms.get(roomId);
        if (!r) return;
        const p = r.pendingPayments.find(x => x.id === paymentId);
        if (!p || !p.jsnState) return;
        // No counter — JSN stands, cancel payment
        r.pendingPayments = r.pendingPayments.filter(x => x.id !== paymentId);
        io.to(roomId).emit('just-say-no-played', { room: r, debtorId: debtor.id, paymentId });
        if (r.pendingPayments.length === 0) {
          resumeTurnTimer(roomId, r);
          io.to(roomId).emit('all-payments-done', { room: r });
          const activePlayer = r.players[r.currentPlayerIndex];
          if (activePlayer?.isAI) advanceTurn(r, roomId);
        }
      }, 10000);
      jsnCounterTimers.set(paymentId, timer);
      return;
    }

    // No counter possible — notify creditor their demand was cancelled, then cancel
    if (creditor?.socketId) {
      const reasonLabel = payment.reason === 'rent' ? 'rent demand'
        : payment.reason === 'birthday' ? "Birthday demand"
        : 'Debt Collector';
      io.to(creditor.socketId).emit('jsn-notification', {
        message: `${debtor.name} cancelled your ${reasonLabel} with Just Say No!`,
      });
    }
    room.pendingPayments = room.pendingPayments.filter(p => p.id !== paymentId);
    io.to(roomId).emit('just-say-no-played', { room, debtorId: debtor.id, paymentId });

    if (room.pendingPayments.length === 0) {
      resumeTurnTimer(roomId, room);
      io.to(roomId).emit('all-payments-done', { room });
      const activePlayer = room.players[room.currentPlayerIndex];
      if (activePlayer?.isAI) advanceTurn(room, roomId);
    }
  });

  // ── Counter-JSN (creditor or debtor responding to a JSN in a payment chain) ──
  socket.on('counter-jsn', ({ roomId, paymentId, response, cardId }: {
    roomId: string; paymentId: string; response: 'jsn' | 'accept'; cardId?: string;
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const payment = room.pendingPayments.find(p => p.id === paymentId);
    if (!payment || !payment.jsnState) return;

    // Auth: paymentId + jsnState together identify the exact expected responder
    const responder = room.players.find(p => p.id === payment.jsnState!.awaitingCounterFromId);
    if (!responder) return;

    // Clear auto-resolve timer
    const t = jsnCounterTimers.get(paymentId);
    if (t) { clearTimeout(t); jsnCounterTimers.delete(paymentId); }

    if (response === 'accept') {
      const jsnCount = payment.jsnState.jsnCount;
      if (jsnCount % 2 === 0) {
        // Even: creditor's counter-JSN wins → reinstate payment
        delete payment.jsnState;
        const debtorPlayer = room.players.find(x => x.id === payment.debtorId);
        if (debtorPlayer?.socketId) {
          io.to(debtorPlayer.socketId).emit('payment-request', {
            paymentId: payment.id, creditorId: payment.creditorId,
            creditorName: room.players.find(x => x.id === payment.creditorId)?.name ?? '',
            amount: payment.amount, reason: payment.reason, room,
          });
        }
        io.to(roomId).emit('room-updated', { room });
      } else {
        // Odd: debtor's JSN wins → cancel payment
        room.pendingPayments = room.pendingPayments.filter(p => p.id !== paymentId);
        io.to(roomId).emit('just-say-no-played', { room, debtorId: payment.debtorId, paymentId });
        if (room.pendingPayments.length === 0) {
          resumeTurnTimer(roomId, room);
          io.to(roomId).emit('all-payments-done', { room });
          const activePlayer = room.players[room.currentPlayerIndex];
          if (activePlayer?.isAI) advanceTurn(room, roomId);
        }
      }
      return;
    }

    // response === 'jsn': play counter-JSN
    if (!cardId) { socket.emit('error', { message: 'Card ID required for JSN' }); return; }
    const jsnIdx = responder.hand.findIndex(c => c.id === cardId && c.actionType === 'sayno');
    if (jsnIdx === -1) { socket.emit('error', { message: 'Just Say No card not found' }); return; }
    const [jsn] = responder.hand.splice(jsnIdx, 1);
    room.discardPile.push(jsn);
    if (!responder.powerCardStats) responder.powerCardStats = {};
    responder.powerCardStats.sayno = (responder.powerCardStats.sayno ?? 0) + 1;

    payment.jsnState.jsnCount++;

    // Find the other party
    const isCreditorResponding = responder.id === payment.creditorId;
    const otherPartyId = isCreditorResponding ? payment.debtorId : payment.creditorId;
    const otherParty = room.players.find(p => p.id === otherPartyId);
    const otherHasJsn = otherParty && !otherParty.isAI && otherParty.hand.some(c => c.actionType === 'sayno');

    if (otherHasJsn && otherParty) {
      payment.jsnState.awaitingCounterFromId = otherParty.id;
      io.to(otherParty.socketId).emit('jsn-counter-opportunity', {
        paymentId,
        debtorName: responder.name,
        room,
      });
      io.to(roomId).emit('room-updated', { room });

      const timer = setTimeout(() => {
        const r = rooms.get(roomId);
        if (!r) return;
        const p = r.pendingPayments.find(x => x.id === paymentId);
        if (!p || !p.jsnState) return;
        // No counter — current JSN count determines outcome
        const jsnCount = p.jsnState.jsnCount;
        if (jsnCount % 2 === 0) {
          // Even: action executes — payment stays
          delete p.jsnState;
          const debtorPlayer = r.players.find(x => x.id === p.debtorId);
          if (debtorPlayer) {
            io.to(debtorPlayer.socketId).emit('payment-request', {
              paymentId: p.id, creditorId: p.creditorId,
              creditorName: r.players.find(x => x.id === p.creditorId)?.name ?? '',
              amount: p.amount, reason: p.reason, room: r,
            });
          }
        } else {
          // Odd: JSN stands — cancel payment
          r.pendingPayments = r.pendingPayments.filter(x => x.id !== paymentId);
          io.to(roomId).emit('just-say-no-played', { room: r, debtorId: p.debtorId, paymentId });
          if (r.pendingPayments.length === 0) {
            resumeTurnTimer(roomId, r);
            io.to(roomId).emit('all-payments-done', { room: r });
            const activePlayer = r.players[r.currentPlayerIndex];
            if (activePlayer?.isAI) advanceTurn(r, roomId);
          }
        }
      }, 10000);
      jsnCounterTimers.set(paymentId, timer);
      return;
    }

    // Other party has no JSN — resolve now
    const jsnCount = payment.jsnState.jsnCount;
    if (jsnCount % 2 === 0) {
      // Even: payment reinstated
      delete payment.jsnState;
      const debtorPlayer = room.players.find(x => x.id === payment.debtorId);
      if (debtorPlayer) {
        io.to(debtorPlayer.socketId).emit('payment-request', {
          paymentId: payment.id, creditorId: payment.creditorId,
          creditorName: room.players.find(x => x.id === payment.creditorId)?.name ?? '',
          amount: payment.amount, reason: payment.reason, room,
        });
      }
      io.to(roomId).emit('room-updated', { room });
    } else {
      // Odd: cancel payment
      room.pendingPayments = room.pendingPayments.filter(p => p.id !== paymentId);
      io.to(roomId).emit('just-say-no-played', { room, debtorId: payment.debtorId, paymentId });
      if (room.pendingPayments.length === 0) {
        resumeTurnTimer(roomId, room);
        io.to(roomId).emit('all-payments-done', { room });
        const activePlayer = room.players[room.currentPlayerIndex];
        if (activePlayer?.isAI) advanceTurn(room, roomId);
      }
    }
  });

  // ── Respond to Deal Breaker (accept or JSN) ──
  socket.on('respond-to-action', ({ roomId, actionId, response, cardId }: {
    roomId: string; actionId: string; response: 'accept' | 'jsn'; cardId?: string;
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const action = room.pendingActions.find(a => a.id === actionId);
    if (!action) return;

    const responder = room.players.find(p => p.id === action.responderId);
    if (!responder || responder.socketId !== socket.id) return;

    if (response === 'accept') {
      // If action is currently "cancelled" (odd jsnCount), notify the victim their JSN worked
      if (action.jsnCount > 0 && action.jsnCount % 2 === 1) {
        const actionLabel = action.type === 'dealbreaker' ? 'Deal Breaker'
          : action.type === 'slydeal' ? 'Sly Deal' : 'Forced Deal';
        const victim = room.players.find(p => p.id === action.targetId);
        if (victim?.socketId) {
          io.to(victim.socketId).emit('jsn-notification', {
            message: `${responder.name} accepted your Just Say No — your ${actionLabel} is cancelled!`,
          });
        }
      }
      resolveAction(room, roomId, action);
      return;
    }

    // response === 'jsn'
    if (!cardId) { socket.emit('error', { message: 'Card ID required' }); return; }
    const jsnIdx = responder.hand.findIndex(c => c.id === cardId && c.actionType === 'sayno');
    if (jsnIdx === -1) { socket.emit('error', { message: 'Just Say No card not found' }); return; }
    const [jsn] = responder.hand.splice(jsnIdx, 1);
    room.discardPile.push(jsn);
    if (!responder.powerCardStats) responder.powerCardStats = {};
    responder.powerCardStats.sayno = (responder.powerCardStats.sayno ?? 0) + 1;

    // Clear current timer
    const t = actionTimers.get(actionId);
    if (t) { clearTimeout(t); actionTimers.delete(actionId); }

    action.jsnCount++;

    // Flip responderId to the other party
    const nextResponderId = responder.id === action.targetId ? action.actorId : action.targetId;
    const nextResponder = room.players.find(p => p.id === nextResponderId);
    const nextHasJsn = nextResponder && !nextResponder.isAI && nextResponder.hand.some(c => c.actionType === 'sayno');

    if (nextHasJsn && nextResponder) {
      action.responderId = nextResponderId;
      // Determine event name based on who's next
      const eventName = nextResponderId === action.actorId ? 'deal-breaker-counter' : 'deal-breaker-request';
      io.to(nextResponder.socketId).emit(eventName, {
        actionId,
        actorName: room.players.find(p => p.id === action.actorId)?.name ?? '',
        color: action.targetData?.color,
        jsnCount: action.jsnCount,
        room,
      });
      io.to(roomId).emit('room-updated', { room });

      // New 15s timer
      const timer = setTimeout(() => {
        const r = rooms.get(roomId);
        if (!r) return;
        const a = r.pendingActions.find(x => x.id === actionId);
        if (a) resolveAction(r, roomId, a);
      }, 15000);
      actionTimers.set(actionId, timer);
    } else if (nextResponder?.isAI && nextResponder.hand.some(c => c.actionType === 'sayno')) {
      // AI counter-JSN: AI actor had their action blocked — auto-play their JSN to counter
      const aiJsnIdx = nextResponder.hand.findIndex(c => c.actionType === 'sayno');
      const [aiJsn] = nextResponder.hand.splice(aiJsnIdx, 1);
      room.discardPile.push(aiJsn);
      if (!nextResponder.powerCardStats) nextResponder.powerCardStats = {};
      nextResponder.powerCardStats.sayno = (nextResponder.powerCardStats.sayno ?? 0) + 1;
      action.jsnCount++; // now even → action back on

      const actionLabel = action.type === 'dealbreaker' ? 'Deal Breaker'
        : action.type === 'slydeal' ? 'Sly Deal' : 'Forced Deal';

      // Notify the human that AI countered their JSN
      io.to(responder.socketId).emit('jsn-notification', {
        message: `${nextResponder.name} countered your Just Say No — ${actionLabel} is back on!`,
      });

      // Check if human (the original target/responder) has another JSN to counter-counter
      const humanHasAnotherJsn = responder.hand.some(c => c.actionType === 'sayno');
      if (humanHasAnotherJsn) {
        action.responderId = responder.id;
        io.to(responder.socketId).emit('deal-breaker-request', {
          actionId,
          actorName: room.players.find(p => p.id === action.actorId)?.name ?? '',
          color: action.targetData?.color,
          jsnCount: action.jsnCount,
          room,
        });
        io.to(roomId).emit('room-updated', { room });

        const timer = setTimeout(() => {
          const r = rooms.get(roomId);
          if (!r) return;
          const a = r.pendingActions.find(x => x.id === actionId);
          if (a) resolveAction(r, roomId, a);
        }, 15000);
        actionTimers.set(actionId, timer);
      } else {
        // No further counter — action executes (jsnCount even)
        io.to(roomId).emit('room-updated', { room });
        resolveAction(room, roomId, action);
      }
    } else {
      // No counter possible
      if (action.jsnCount % 2 === 1) {
        // Odd = action cancelled — notify both parties
        const actionLabel = action.type === 'dealbreaker' ? 'Deal Breaker'
          : action.type === 'slydeal' ? 'Sly Deal' : 'Forced Deal';
        const actorPlayer = room.players.find(p => p.id === action.actorId);
        if (actorPlayer?.socketId) {
          io.to(actorPlayer.socketId).emit('jsn-notification', {
            message: `${responder.name} cancelled your ${actionLabel} with Just Say No!`,
          });
        }
        io.to(responder.socketId).emit('jsn-notification', {
          message: `Your Just Say No cancelled the ${actionLabel}!`,
        });
      }
      // Even: action executes via resolveAction
      resolveAction(room, roomId, action);
    }
  });

  // ── Move wildcard (free rearrangement — spec §9.3, does NOT cost a play) ──
  socket.on('move-wildcard', ({ roomId, playerId, cardId, fromColor, toColor }: {
    roomId: string; playerId: string; cardId: string;
    fromColor: PropertyColor; toColor: PropertyColor;
  }) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;

    const player = room.players[room.currentPlayerIndex];
    if (player.id !== playerId) { socket.emit('error', { message: 'Not your turn' }); return; }

    const fromSet = player.properties.find(p => p.color === fromColor);
    if (!fromSet) return;

    const ci = fromSet.cards.findIndex(c => c.id === cardId && (c.isDualColor || c.isWildcard));
    if (ci === -1) { socket.emit('error', { message: 'Wildcard not found' }); return; }

    const card = fromSet.cards[ci];

    // Validate target color: universal wildcards (colors[0]===colors[1]) can go anywhere,
    // dual-color wildcards must target one of their allowed colors
    const isUniversal = card.colors && card.colors.length >= 2 && card.colors[0] === card.colors[card.colors.length - 1];
    const allowed = card.colors ?? [];
    if (!isUniversal && !allowed.includes(toColor)) {
      socket.emit('error', { message: 'Wildcard cannot go to that color' }); return;
    }

    // Block moving to a complete set
    const toSetCheck = player.properties.find(p => p.color === toColor);
    if (toSetCheck?.isComplete) {
      socket.emit('error', { message: 'That property set is already complete' }); return;
    }

    // Remove from source set
    fromSet.cards.splice(ci, 1);
    const wasComplete = fromSet.isComplete;
    fromSet.isComplete = checkPropertySetComplete(fromSet);
    // If source set lost completeness, return house/hotel cards to discard
    if (wasComplete && !fromSet.isComplete) {
      clearSetImprovements(fromSet, room.discardPile);
    }

    // Update the card's displayed color and add to target set
    card.color = toColor;
    const toSet = player.properties.find(p => p.color === toColor);
    if (toSet) {
      toSet.cards.push(card);
      toSet.isComplete = checkPropertySetComplete(toSet);
    }

    const winner = checkWinner(room);
    if (winner) {
      room.winner = winner; room.phase = 'ended';
      clearTurnTimer(roomId);
      io.to(roomId).emit('game-ended', { room, winner });
      return;
    }

    io.to(roomId).emit('player-updated', { player, room });
  });

  // ── Emoji reaction ──
  socket.on('send-reaction', ({ roomId, playerId, emoji }: { roomId: string; playerId: string; emoji: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === playerId) ?? room.spectators.find(s => s.id === playerId);
    if (!player) return;
    // Accept any emoji — validate it's short (emoji are 1–15 chars) and text-only
    if (typeof emoji !== 'string' || emoji.length === 0 || emoji.length > 20) return;
    io.to(roomId).emit('player-reaction', { playerId, playerName: player.name, emoji });
  });

  // ── End turn ──
  socket.on('end-turn', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players[room.currentPlayerIndex];
    if (player.id !== playerId) return;

    if (room.pendingPayments.length > 0) {
      socket.emit('error', { message: 'Waiting for other players to pay' });
      return;
    }

    if (room.pendingActions.length > 0) {
      socket.emit('error', { message: 'Waiting for opponent to respond to Deal Breaker' });
      return;
    }

    if (player.hand.length > 7) {
      socket.emit('must-discard', { count: player.hand.length - 7 });
      return;
    }

    advanceTurn(room, roomId);
  });

  // ── Discard cards ──
  socket.on('discard-cards', ({ roomId, playerId, cardIds }: { roomId: string; playerId: string; cardIds: string[] }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players[room.currentPlayerIndex];
    if (player.id !== playerId) return;

    cardIds.forEach(id => {
      const idx = player.hand.findIndex(c => c.id === id);
      if (idx !== -1) room.discardPile.push(player.hand.splice(idx, 1)[0]);
    });

    if (player.hand.length > 7) { socket.emit('must-discard', { count: player.hand.length - 7 }); return; }
    advanceTurn(room, roomId);
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    rooms.forEach((room, roomId) => {
      // Remove spectators immediately
      const specIdx = room.spectators.findIndex(s => s.socketId === socket.id);
      if (specIdx !== -1) {
        const [spectator] = room.spectators.splice(specIdx, 1);
        io.to(roomId).emit('spectator-left', { spectator, room });
        return;
      }

      const idx = room.players.findIndex(p => p.socketId === socket.id);
      if (idx === -1) return;
      const player = room.players[idx];
      if (player.isAI) return;

      // Mark disconnected but keep in room for 60 seconds
      player.disconnected = true;
      player.socketId = '';
      io.to(roomId).emit('player-disconnected', { player, room });

      const dtKey = `${roomId}:${player.id}`;
      const timer = setTimeout(() => {
        const r = rooms.get(roomId);
        if (!r) return;
        const pidx = r.players.findIndex(p => p.id === player.id);
        if (pidx === -1) return;
        // Still disconnected after grace period — remove
        if (!r.players[pidx].disconnected) return; // they reconnected
        r.players.splice(pidx, 1);
        disconnectTimers.delete(dtKey);
        const hasHumans = r.players.some(p => !p.isAI);
        if (!hasHumans) {
          // No human players left — kill room (AI-only rooms serve no purpose)
          clearTurnTimer(roomId);
          rooms.delete(roomId);
          console.log(`🗑️  Room ${roomId} auto-closed (no humans remaining)`);
        } else {
          io.to(roomId).emit('player-left', { player, room: r });
        }
      }, 60000);
      disconnectTimers.set(dtKey, timer);
    });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log('🎲 =======================================');
  console.log('🎲  MONOPOLY DEAL SERVER RUNNING');
  console.log(`🎲  Port: ${PORT}`);
  console.log(`🎲  URL: http://localhost:${PORT}`);
  console.log('🎲 =======================================');
});
