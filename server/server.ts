import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type { GameRoom, Player, Card, PropertySet, GameVersion, PendingPayment, PendingAction, Spectator, PropertyColor } from '../src/types/game';
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
  transports: ['websocket', 'polling'],
});

app.use(express.static(path.join(__dirname, '../dist')));
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function createPlayer(name: string, socketId: string, isHost: boolean, isAI = false, persistentPlayerId?: string): Player {
  return {
    id: uuidv4(),
    name,
    socketId,
    persistentPlayerId: persistentPlayerId ?? uuidv4(),
    hand: [], bank: [], properties: [],
    isHost, isReady: true, isAI,
    cardsPlayedThisTurn: 0,
    hadZeroCardsAtEnd: false,
  };
}

function createEmptyPropertySets(): PropertySet[] {
  const colors = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'black', 'utility'] as const;
  return colors.map(color => ({ color, cards: [], hasHouse: false, hasHotel: false, isComplete: false }));
}

function dealInitialCards(room: GameRoom): void {
  room.players.forEach(player => {
    player.hand = safeDraw(room, 5);
    player.properties = createEmptyPropertySets();
  });
}

function checkPropertySetComplete(set: PropertySet): boolean {
  return set.cards.length >= PROPERTY_SET_REQUIREMENTS[set.color];
}

function checkWinner(room: GameRoom): Player | null {
  for (const player of room.players) {
    if (player.properties.filter(s => s.isComplete).length >= 3) return player;
  }
  return null;
}

/** Draw safely, reshuffling discard pile if deck runs out (spec §9.6). */
function safeDraw(room: GameRoom, count: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      if (room.discardPile.length === 0) break;
      room.deck = shuffleDeck([...room.discardPile]);
      room.discardPile = [];
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
    }
  }
}

/** Auto-pay debt for AI: bank first (smallest), then properties. */
function aiPay(_room: GameRoom, debtor: Player, creditor: Player, amount: number): void {
  let remaining = amount;
  const bankSorted = [...debtor.bank].sort((a, b) => a.value - b.value);
  for (const card of bankSorted) {
    if (remaining <= 0) break;
    const idx = debtor.bank.findIndex(c => c.id === card.id);
    if (idx !== -1) { debtor.bank.splice(idx, 1); creditor.bank.push(card); remaining -= card.value; }
  }
  if (remaining > 0) {
    for (const set of debtor.properties) {
      while (set.cards.length > 0 && remaining > 0) {
        const card = set.cards.pop()!;
        set.isComplete = false;
        const cs = creditor.properties.find(p => p.color === set.color);
        if (cs) { cs.cards.push(card); cs.isComplete = checkPropertySetComplete(cs); }
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

  for (const cardId of bankCardIds) {
    const idx = debtor.bank.findIndex(c => c.id === cardId);
    if (idx !== -1) { const [card] = debtor.bank.splice(idx, 1); creditor.bank.push(card); }
  }
  for (const { color, cardId } of propertyCards) {
    const debtorSet = debtor.properties.find(p => p.color === color);
    if (!debtorSet) continue;
    if (debtorSet.isComplete) continue; // complete sets are protected from debt payment
    const ci = debtorSet.cards.findIndex(c => c.id === cardId);
    if (ci === -1) continue;
    const [card] = debtorSet.cards.splice(ci, 1);
    debtorSet.isComplete = checkPropertySetComplete(debtorSet);
    const creditorSet = creditor.properties.find(p => p.color === color);
    if (creditorSet) { creditorSet.cards.push(card); creditorSet.isComplete = checkPropertySetComplete(creditorSet); }
  }
}

// ─── AI Turn ─────────────────────────────────────────────────────────────────

function processAITurn(room: GameRoom, player: Player): void {
  if (!player.isAI) return;

  const roomId = [...rooms.entries()].find(([, r]) => r === room)?.[0] || '';

  const drawCount = player.hadZeroCardsAtEnd ? 5 : 2;
  player.hadZeroCardsAtEnd = false;
  player.hand.push(...safeDraw(room, drawCount));

  let played = 0;
  while (played < 3 && player.hand.length > 0) {
    const props  = player.hand.filter(c => c.type === 'property' || c.type === 'wild');
    const cash   = player.hand.filter(c => c.type === 'cash');
    const acts   = player.hand.filter(c => c.type === 'action' && c.actionType !== 'sayno' && c.actionType !== 'doublerent');
    const rents  = player.hand.filter(c => c.type === 'rent');
    const others = room.players.filter(p => p.id !== player.id);

    let chosenCard: Card | null = null;
    let chosenTarget: any = null;

    // 1. PassGo — draw extra cards first
    const passgo = acts.find(c => c.actionType === 'passgo');
    if (passgo) { chosenCard = passgo; }

    // 2. Birthday — collect $2 from everyone with something to pay
    if (!chosenCard) {
      const bday = acts.find(c => c.actionType === 'birthday');
      if (bday && others.some(p => p.bank.length > 0 || p.properties.some(s => s.cards.length > 0))) {
        chosenCard = bday;
      }
    }

    // 3. Debt Collector — collect $5 from richest opponent
    if (!chosenCard) {
      const dc = acts.find(c => c.actionType === 'debtcollector');
      if (dc && others.length > 0) {
        const richest = others.reduce((b, p) =>
          p.bank.reduce((s, c) => s + c.value, 0) > b.bank.reduce((s, c) => s + c.value, 0) ? p : b, others[0]);
        chosenCard = dc;
        chosenTarget = { targetPlayerId: richest.id };
      }
    }

    // 4. Sly Deal — steal highest-value property from an incomplete set
    if (!chosenCard) {
      const sly = acts.find(c => c.actionType === 'slydeal');
      if (sly) {
        let bestOpp: Player | null = null, bestColor: PropertyColor | null = null, bestCardId: string | null = null, bestVal = -1;
        for (const opp of others) {
          for (const set of opp.properties.filter(s => !s.isComplete && s.cards.length > 0)) {
            for (const c of set.cards) {
              if (c.value > bestVal) { bestVal = c.value; bestOpp = opp; bestColor = set.color; bestCardId = c.id; }
            }
          }
        }
        if (bestOpp && bestColor && bestCardId) { chosenCard = sly; chosenTarget = { targetPlayerId: bestOpp.id, color: bestColor, cardId: bestCardId }; }
      }
    }

    // 5. Best Rent — charge the color that earns most
    if (!chosenCard && rents.length > 0) {
      let bestRentCard: Card | null = null, bestRentColor: PropertyColor | null = null, bestRent = 0;
      for (const rc of rents) {
        const colors: PropertyColor[] = (rc.rentColors && rc.rentColors.length > 0)
          ? rc.rentColors.filter(col => (player.properties.find(p => p.color === col)?.cards.length ?? 0) > 0)
          : player.properties.filter(s => s.cards.length > 0).map(s => s.color);
        for (const col of colors) {
          const r = calculateRent(player, col, false);
          if (r > bestRent) { bestRent = r; bestRentColor = col; bestRentCard = rc; }
        }
      }
      if (bestRentCard && bestRentColor && bestRent > 0) { chosenCard = bestRentCard; chosenTarget = { color: bestRentColor }; }
    }

    // 6. Properties — prioritize near-complete sets
    if (!chosenCard && props.length > 0) {
      const sorted = [...props].sort((a, b) => {
        const ac = (a.color || a.colors?.[0]) as PropertyColor;
        const bc = (b.color || b.colors?.[0]) as PropertyColor;
        const aSet = player.properties.find(p => p.color === ac);
        const bSet = player.properties.find(p => p.color === bc);
        const aReq = PROPERTY_SET_REQUIREMENTS[ac] ?? 3;
        const bReq = PROPERTY_SET_REQUIREMENTS[bc] ?? 3;
        return ((bSet?.cards.length ?? 0) / bReq) - ((aSet?.cards.length ?? 0) / aReq);
      });
      chosenCard = sorted[0];
      chosenTarget = { color: chosenCard.color || chosenCard.colors?.[0] };
    }

    // 7. Cash — bank smallest bills first to preserve high-value cards
    if (!chosenCard && cash.length > 0) {
      chosenCard = [...cash].sort((a, b) => a.value - b.value)[0];
    }

    // 8. Discard leftover action cards we can't use
    if (!chosenCard && acts.length > 0) { chosenCard = acts[0]; }

    if (!chosenCard) break;

    const idx = player.hand.findIndex(c => c.id === chosenCard!.id);
    if (idx === -1) break;
    player.hand.splice(idx, 1);

    if (chosenCard.type === 'property' || chosenCard.type === 'wild') {
      const color = (chosenTarget?.color || chosenCard.color) as PropertyColor | undefined;
      if (color) {
        chosenCard.color = color;
        const set = player.properties.find(p => p.color === color);
        if (set) { set.cards.push(chosenCard); set.isComplete = checkPropertySetComplete(set); }
      }
    } else if (chosenCard.type === 'cash') {
      player.bank.push(chosenCard);
    } else if (chosenCard.type === 'rent') {
      room.discardPile.push(chosenCard);
      const rentColor = chosenTarget?.color as PropertyColor | undefined;
      if (rentColor) {
        const rent = calculateRent(player, rentColor, false);
        requestPayments(room, roomId, player, others, rent, 'rent');
      }
      played++;
      if (room.pendingPayments.length > 0) break;
      continue;
    } else {
      // Action card — delegate to handleActionCard (handles discard + side effects)
      handleActionCard(room, roomId, player, chosenCard, chosenTarget);
      played++;
      if (room.pendingPayments.length > 0 || room.pendingActions.length > 0) break;
      continue;
    }

    played++;
  }

  player.cardsPlayedThisTurn = 0;
  player.hadZeroCardsAtEnd = player.hand.length === 0;

  while (player.hand.length > 7) {
    room.discardPile.push(player.hand.pop()!);
  }

  const winner = checkWinner(room);
  if (winner) {
    room.winner = winner; room.phase = 'ended';
    clearTurnTimer(roomId);
    io.to(roomId).emit('game-ended', { room, winner });
    return;
  }

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
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  room.turnPhase = 'draw';
  room.turnStartedAt = Date.now();

  io.to(roomId).emit('turn-ended', { room, nextPlayer: room.players[room.currentPlayerIndex] });

  startTurnTimer(roomId, room);

  const next = room.players[room.currentPlayerIndex];
  if (next.isAI) setTimeout(() => processAITurn(room, next), 2000);
}

// ─── Deal Breaker Action Resolver ────────────────────────────────────────────

function executeDealBreaker(room: GameRoom, action: PendingAction): void {
  const actor = room.players.find(p => p.id === action.actorId);
  const target = room.players.find(p => p.id === action.targetId);
  if (!actor || !target) return;
  const targetSet = target.properties.find(p => p.color === action.targetData?.color);
  const mySet = actor.properties.find(p => p.color === action.targetData?.color);
  if (targetSet?.isComplete && mySet) {
    mySet.cards.push(...targetSet.cards);
    mySet.hasHouse = targetSet.hasHouse;
    mySet.hasHotel = targetSet.hasHotel;
    mySet.isComplete = true;
    targetSet.cards = []; targetSet.hasHouse = false; targetSet.hasHotel = false; targetSet.isComplete = false;
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

function resolveAction(room: GameRoom, roomId: string, action: PendingAction): void {
  // Clear any pending timer for this action
  const t = actionTimers.get(action.id);
  if (t) { clearTimeout(t); actionTimers.delete(action.id); }

  // Execute if jsnCount is even (action wins), skip if odd (JSN wins)
  if (action.jsnCount % 2 === 0) {
    executeDealBreaker(room, action);
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

function handleActionCard(room: GameRoom, roomId: string, player: Player, card: Card, targetData?: any): void {
  room.discardPile.push(card);

  switch (card.actionType) {
    case 'passgo': {
      const extra = safeDraw(room, 2);
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
      // Target is AI or has no JSN — execute immediately
      if (targetPlayer) {
        const targetSet = targetPlayer.properties.find(p => p.color === targetData?.color);
        const mySet = player.properties.find(p => p.color === targetData?.color);
        if (targetSet?.isComplete && mySet) {
          mySet.cards.push(...targetSet.cards);
          mySet.hasHouse = targetSet.hasHouse;
          mySet.hasHotel = targetSet.hasHotel;
          mySet.isComplete = true;
          targetSet.cards = []; targetSet.hasHouse = false; targetSet.hasHotel = false; targetSet.isComplete = false;
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
      if (targetPlayer) {
        const targetSet = targetPlayer.properties.find(p => p.color === targetData?.color);
        if (targetSet && !targetSet.isComplete) {
          const ci = targetSet.cards.findIndex(c => c.id === targetData?.cardId);
          if (ci !== -1) {
            const [stolen] = targetSet.cards.splice(ci, 1);
            targetSet.isComplete = checkPropertySetComplete(targetSet);
            const mySet = player.properties.find(p => p.color === targetData?.color);
            if (mySet) { mySet.cards.push(stolen); mySet.isComplete = checkPropertySetComplete(mySet); }
            // Notify the victim
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
      if (targetPlayer) {
        const mySet = player.properties.find(p => p.color === targetData?.myColor);
        const theirSet = targetPlayer.properties.find(p => p.color === targetData?.theirColor);
        if (mySet && theirSet && !theirSet.isComplete) {
          const myCI = mySet.cards.findIndex(c => c.id === targetData?.myCardId);
          const theirCI = theirSet.cards.findIndex(c => c.id === targetData?.theirCardId);
          if (myCI !== -1 && theirCI !== -1) {
            const [myCard] = mySet.cards.splice(myCI, 1);
            const [theirCard] = theirSet.cards.splice(theirCI, 1);
            theirCard.color = mySet.color as PropertyColor;
            myCard.color = theirSet.color as PropertyColor;
            mySet.cards.push(theirCard); mySet.isComplete = checkPropertySetComplete(mySet);
            theirSet.cards.push(myCard); theirSet.isComplete = checkPropertySetComplete(theirSet);
            // Notify the victim
            if (targetPlayer.socketId) {
              io.to(targetPlayer.socketId).emit('card-taken', {
                takerName: player.name, cardName: theirCard.name,
                color: targetData?.theirColor, dealType: 'forceddeal',
              });
            }
          }
        }
      }
      break;
    }

    case 'house': {
      if (targetData?.color) {
        const set = player.properties.find(p => p.color === targetData.color);
        if (set?.isComplete && !set.hasHouse) set.hasHouse = true;
      }
      break;
    }

    case 'hotel': {
      if (targetData?.color) {
        const set = player.properties.find(p => p.color === targetData.color);
        if (set?.isComplete && set.hasHouse && !set.hasHotel) set.hasHotel = true;
      }
      break;
    }
  }
}

// ─── Socket.IO ───────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  socket.on('create-room', ({ playerName, version, mode, aiCount, turnTimeLimit, persistentPlayerId }: {
    playerName: string; version: string; mode: 'single' | 'multi'; aiCount?: number; turnTimeLimit?: number; persistentPlayerId?: string;
  }) => {
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    const player = createPlayer(playerName, socket.id, true, false, persistentPlayerId);
    const roomPlayers: Player[] = [player];

    if (mode === 'single' && aiCount) {
      for (let i = 0; i < aiCount; i++) {
        roomPlayers.push(createPlayer(`${AI_NAMES[i % AI_NAMES.length]} (AI)`, `ai-${i}`, false, true));
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

  socket.on('add-ai-player', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.hostId !== playerId) { socket.emit('error', { message: 'Only host can add AI players' }); return; }
    if (room.players.length >= 5) { socket.emit('error', { message: 'Room is full' }); return; }
    const aiIndex = room.players.filter(p => p.isAI).length;
    const ai = createPlayer(`${AI_NAMES[aiIndex % AI_NAMES.length]} (AI)`, `ai-${Date.now()}`, false, true);
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
    const drawn = safeDraw(room, count);
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

    if (player.cardsPlayedThisTurn >= 3) {
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
        const color = targetData?.color || card.color;
        if (color) {
          card.color = color as PropertyColor; // keep card.color in sync with the set it lives in
          const set = player.properties.find(p => p.color === color);
          if (set) { set.cards.push(card); set.isComplete = checkPropertySetComplete(set); }
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
            player.cardsPlayedThisTurn++; // Double Rent card counts as an extra play
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

    player.cardsPlayedThisTurn++;

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

    const debtor = room.players.find(p => p.id === payment.debtorId);
    if (!debtor || debtor.socketId !== socket.id) return;

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

    const debtor = room.players.find(p => p.id === payment.debtorId);
    if (!debtor || debtor.socketId !== socket.id) return;

    const jsnIdx = debtor.hand.findIndex(c => c.id === cardId && c.actionType === 'sayno');
    if (jsnIdx === -1) { socket.emit('error', { message: 'Just Say No card not found in hand' }); return; }

    const [jsn] = debtor.hand.splice(jsnIdx, 1);
    room.discardPile.push(jsn);

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
          io.to(roomId).emit('all-payments-done', { room: r });
          const activePlayer = r.players[r.currentPlayerIndex];
          if (activePlayer?.isAI) advanceTurn(r, roomId);
        }
      }, 10000);
      jsnCounterTimers.set(paymentId, timer);
      return;
    }

    // No counter possible — cancel payment immediately
    room.pendingPayments = room.pendingPayments.filter(p => p.id !== paymentId);
    io.to(roomId).emit('just-say-no-played', { room, debtorId: debtor.id, paymentId });

    if (room.pendingPayments.length === 0) {
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

    const responder = room.players.find(p => p.id === payment.jsnState!.awaitingCounterFromId);
    if (!responder || responder.socketId !== socket.id) return;

    // Clear auto-resolve timer
    const t = jsnCounterTimers.get(paymentId);
    if (t) { clearTimeout(t); jsnCounterTimers.delete(paymentId); }

    if (response === 'accept') {
      // JSN stands — cancel payment
      const debtorId = payment.jsnState.jsnCount % 2 === 1 ? payment.debtorId : payment.creditorId;
      room.pendingPayments = room.pendingPayments.filter(p => p.id !== paymentId);
      io.to(roomId).emit('just-say-no-played', { room, debtorId, paymentId });
      if (room.pendingPayments.length === 0) {
        io.to(roomId).emit('all-payments-done', { room });
        const activePlayer = room.players[room.currentPlayerIndex];
        if (activePlayer?.isAI) advanceTurn(room, roomId);
      }
      return;
    }

    // response === 'jsn': play counter-JSN
    if (!cardId) { socket.emit('error', { message: 'Card ID required for JSN' }); return; }
    const jsnIdx = responder.hand.findIndex(c => c.id === cardId && c.actionType === 'sayno');
    if (jsnIdx === -1) { socket.emit('error', { message: 'Just Say No card not found' }); return; }
    const [jsn] = responder.hand.splice(jsnIdx, 1);
    room.discardPile.push(jsn);

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
      resolveAction(room, roomId, action);
      return;
    }

    // response === 'jsn'
    if (!cardId) { socket.emit('error', { message: 'Card ID required' }); return; }
    const jsnIdx = responder.hand.findIndex(c => c.id === cardId && c.actionType === 'sayno');
    if (jsnIdx === -1) { socket.emit('error', { message: 'Just Say No card not found' }); return; }
    const [jsn] = responder.hand.splice(jsnIdx, 1);
    room.discardPile.push(jsn);

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
    } else {
      // No counter possible — resolve with current jsnCount
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

    // Remove from source set
    fromSet.cards.splice(ci, 1);
    const wasComplete = fromSet.isComplete;
    fromSet.isComplete = checkPropertySetComplete(fromSet);
    // If source set lost completeness, remove house/hotel (they require a complete set)
    if (wasComplete && !fromSet.isComplete) {
      fromSet.hasHouse = false;
      fromSet.hasHotel = false;
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
        if (r.players.length === 0 || (r.players.length === 1 && r.players[0].isAI)) {
          clearTurnTimer(roomId);
          rooms.delete(roomId);
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
