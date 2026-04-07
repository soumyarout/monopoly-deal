import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import type { GameRoom, Player, Card, PropertySet, GameVersion, PendingPayment, PropertyColor } from '../src/types/game';
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

function createPlayer(name: string, socketId: string, isHost: boolean, isAI = false): Player {
  return {
    id: uuidv4(), name, socketId,
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

  const drawCount = player.hadZeroCardsAtEnd ? 5 : 2;
  player.hadZeroCardsAtEnd = false;
  const drawn = safeDraw(room, drawCount);
  player.hand.push(...drawn);

  let played = 0;
  while (played < 3 && player.hand.length > 0) {
    const props = player.hand.filter(c => c.type === 'property' || c.type === 'wild');
    const cash  = player.hand.filter(c => c.type === 'cash');
    const acts  = player.hand.filter(c => c.type === 'action' && c.actionType !== 'sayno');
    const rents = player.hand.filter(c => c.type === 'rent');

    let card: Card | null = null;
    let targetData: any = null;

    if (props.length > 0) {
      card = props[0];
      targetData = { color: card.color || card.colors?.[0] };
    } else if (cash.length > 0) {
      card = cash[0];
    } else if (acts.length > 0) {
      card = acts[0];
      if (card.actionType === 'passgo') {
        player.hand.splice(player.hand.findIndex(c => c.id === card!.id), 1);
        room.discardPile.push(card);
        player.hand.push(...safeDraw(room, 2));
        played++;
        continue;
      }
    } else if (rents.length > 0) {
      card = rents[0];
      // Pick a color we own
      const rentable = (card.rentColors || []).find(color => {
        const s = player.properties.find(p => p.color === color);
        return s && s.cards.length > 0;
      });
      if (!rentable) { player.hand.splice(player.hand.findIndex(c => c.id === card!.id), 1); room.discardPile.push(card); played++; continue; }
      const rent = calculateRent(player, rentable, false);
      const roomId = [...rooms.entries()].find(([, r]) => r === room)?.[0] || '';
      player.hand.splice(player.hand.findIndex(c => c.id === card!.id), 1);
      room.discardPile.push(card);
      const opponents = room.players.filter(p => p.id !== player.id);
      requestPayments(room, roomId, player, opponents, rent, 'rent');
      played++;
      continue;
    }

    if (!card) break;

    const idx = player.hand.findIndex(c => c.id === card!.id);
    if (idx === -1) break;
    player.hand.splice(idx, 1);

    if (card.type === 'property' || card.type === 'wild') {
      const color = targetData?.color || card.color;
      if (color) {
        const set = player.properties.find(p => p.color === color);
        if (set) { set.cards.push(card); set.isComplete = checkPropertySetComplete(set); }
      }
    } else if (card.type === 'cash') {
      player.bank.push(card);
    } else {
      room.discardPile.push(card);
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
    const aiRoomId = [...rooms.entries()].find(([, r]) => r === room)?.[0] || '';
    clearTurnTimer(aiRoomId);
    io.to(aiRoomId).emit('game-ended', { room, winner });
    return;
  }

  const roomId = [...rooms.entries()].find(([, r]) => r === room)?.[0] || '';
  advanceTurn(room, roomId);
}

// ─── Advance Turn ────────────────────────────────────────────────────────────

function advanceTurn(room: GameRoom, roomId: string) {
  // Don't advance if human payments are still pending
  if (room.pendingPayments.length > 0) return;

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
      if (targetPlayer) {
        const targetSet = targetPlayer.properties.find(p => p.color === targetData?.color);
        const mySet = player.properties.find(p => p.color === targetData?.color);
        if (targetSet?.isComplete && mySet) {
          mySet.cards.push(...targetSet.cards);
          mySet.hasHouse = targetSet.hasHouse;
          mySet.hasHotel = targetSet.hasHotel;
          mySet.isComplete = true;
          targetSet.cards = []; targetSet.hasHouse = false; targetSet.hasHotel = false; targetSet.isComplete = false;
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
            mySet.cards.push(theirCard); mySet.isComplete = checkPropertySetComplete(mySet);
            theirSet.cards.push(myCard); theirSet.isComplete = checkPropertySetComplete(theirSet);
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

  socket.on('create-room', ({ playerName, version, mode, aiCount, turnTimeLimit }: {
    playerName: string; version: string; mode: 'single' | 'multi'; aiCount?: number; turnTimeLimit?: number;
  }) => {
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    const player = createPlayer(playerName, socket.id, true);
    const roomPlayers: Player[] = [player];

    if (mode === 'single' && aiCount) {
      for (let i = 0; i < aiCount; i++) {
        roomPlayers.push(createPlayer(`${AI_NAMES[i % AI_NAMES.length]} (AI)`, `ai-${i}`, false, true));
      }
    }

    const room: GameRoom = {
      id: roomId, hostId: player.id, players: roomPlayers,
      version: version as GameVersion, phase: 'lobby',
      deck: generateDeck(version as GameVersion), discardPile: [],
      currentPlayerIndex: 0, turnPhase: 'draw', winner: null,
      createdAt: Date.now(), mode,
      pendingPayments: [], doubleRentActive: false,
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

  socket.on('join-room', ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room)                    { socket.emit('error', { message: 'Room not found' }); return; }
    if (room.phase !== 'lobby')   { socket.emit('error', { message: 'Game already in progress' }); return; }
    if (room.players.length >= 5) { socket.emit('error', { message: 'Room is full' }); return; }

    const player = createPlayer(playerName, socket.id, false);
    room.players.push(player);
    socket.join(roomId);
    socket.emit('room-joined', { room, player });
    socket.to(roomId).emit('player-joined', { player, room });
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

        const doubled = room.doubleRentActive;
        room.doubleRentActive = false; // consumed

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
    room.pendingPayments = room.pendingPayments.filter(p => p.id !== paymentId);

    io.to(roomId).emit('just-say-no-played', { room, debtorId: debtor.id, paymentId });

    if (room.pendingPayments.length === 0) {
      io.to(roomId).emit('all-payments-done', { room });
      // If it was an AI's turn that stalled waiting for human payments, advance now
      const activePlayer = room.players[room.currentPlayerIndex];
      if (activePlayer?.isAI) advanceTurn(room, roomId);
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
      const idx = room.players.findIndex(p => p.socketId === socket.id);
      if (idx === -1) return;
      const player = room.players[idx];
      if (player.isAI) return;
      room.players.splice(idx, 1);
      if (room.players.length === 0 || (room.players.length === 1 && room.players[0].isAI)) {
        clearTurnTimer(roomId);
        rooms.delete(roomId);
      } else {
        io.to(roomId).emit('player-left', { player, room });
      }
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
