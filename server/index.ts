import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameRoom, Player, Card, PropertySet, GamePhase, TurnPhase } from '../src/types/game';
import { generateDeck, drawCards, shuffleDeck, PROPERTY_SET_REQUIREMENTS } from '../src/data/cards';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store active rooms
const rooms: Map<string, GameRoom> = new Map();

// Helper to create a new player
function createPlayer(name: string, socketId: string, isHost: boolean): Player {
  return {
    id: uuidv4(),
    name,
    socketId,
    hand: [],
    bank: [],
    properties: [],
    isHost,
    isReady: false,
    cardsPlayedThisTurn: 0,
  };
}

// Helper to create empty property sets for a player
function createEmptyPropertySets(): PropertySet[] {
  const colors = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'black', 'utility'] as const;
  return colors.map((color) => ({
    color,
    cards: [],
    hasHouse: false,
    hasHotel: false,
    isComplete: false,
  }));
}

// Deal initial cards
function dealInitialCards(room: GameRoom): void {
  room.players.forEach((player) => {
    const { cards, remainingDeck } = drawCards(room.deck, 5);
    player.hand = cards;
    room.deck = remainingDeck;
    player.properties = createEmptyPropertySets();
  });
}

// Check if a property set is complete
function checkPropertySetComplete(propertySet: PropertySet): boolean {
  const required = PROPERTY_SET_REQUIREMENTS[propertySet.color];
  return propertySet.cards.length >= required;
}

// Get rent amount for a property set
function getRentAmount(propertySet: PropertySet): number {
  const rentValues = [1, 2, 3, 4, 5, 6, 7, 8]; // Rent values based on set size
  const baseRent = rentValues[Math.min(propertySet.cards.length - 1, rentValues.length - 1)] || 1;
  let totalRent = baseRent;
  if (propertySet.hasHouse) totalRent += 3;
  if (propertySet.hasHotel) totalRent += 4;
  return totalRent;
}

// Check for winner
function checkWinner(room: GameRoom): Player | null {
  for (const player of room.players) {
    let completeSets = 0;
    for (const set of player.properties) {
      if (checkPropertySetComplete(set)) {
        completeSets++;
      }
    }
    // Win condition: 3 complete property sets
    if (completeSets >= 3) {
      return player;
    }
  }
  return null;
}

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Create a new room
  socket.on('create-room', ({ playerName, version }: { playerName: string; version: string }) => {
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    const player = createPlayer(playerName, socket.id, true);
    
    const room: GameRoom = {
      id: roomId,
      hostId: player.id,
      players: [player],
      version: version as any,
      phase: 'lobby',
      deck: generateDeck(version as any),
      discardPile: [],
      currentPlayerIndex: 0,
      turnPhase: 'draw',
      winner: null,
      createdAt: Date.now(),
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('room-created', { room, player });
    console.log(`Room ${roomId} created by ${playerName}`);
  });

  // Join an existing room
  socket.on('join-room', ({ roomId, playerName }: { roomId: string; playerName: string }) => {
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.phase !== 'lobby') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    if (room.players.length >= 5) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    const player = createPlayer(playerName, socket.id, false);
    room.players.push(player);
    socket.join(roomId);
    
    socket.emit('room-joined', { room, player });
    socket.to(roomId).emit('player-joined', { player, room });
    console.log(`${playerName} joined room ${roomId}`);
  });

  // Player ready
  socket.on('player-ready', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isReady = true;
      io.to(roomId).emit('player-updated', { player, room });
    }
  });

  // Start game
  socket.on('start-game', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players' });
      return;
    }

    room.phase = 'playing';
    room.currentPlayerIndex = 0;
    room.turnPhase = 'draw';
    dealInitialCards(room);

    io.to(roomId).emit('game-started', { room });
    console.log(`Game started in room ${roomId}`);
  });

  // Draw cards
  socket.on('draw-cards', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[room.currentPlayerIndex];
    if (player.id !== playerId || room.turnPhase !== 'draw') return;

    const { cards, remainingDeck } = drawCards(room.deck, 2);
    player.hand.push(...cards);
    room.deck = remainingDeck;
    room.turnPhase = 'play';

    io.to(roomId).emit('cards-drawn', { player, cards, room });
  });

  // Play card
  socket.on('play-card', ({ 
    roomId, 
    playerId, 
    cardId, 
    targetData 
  }: { 
    roomId: string; 
    playerId: string; 
    cardId: string;
    targetData?: any;
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[room.currentPlayerIndex];
    if (player.id !== playerId || room.turnPhase !== 'play') return;

    const cardIndex = player.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const card = player.hand[cardIndex];
    
    // Remove card from hand
    player.hand.splice(cardIndex, 1);

    // Handle different card types
    switch (card.type) {
      case 'property':
      case 'wild':
        // Add to property set
        const color = targetData?.color || card.color;
        if (color) {
          const propertySet = player.properties.find((p) => p.color === color);
          if (propertySet) {
            propertySet.cards.push(card);
            propertySet.isComplete = checkPropertySetComplete(propertySet);
          }
        }
        break;

      case 'cash':
        // Add to bank
        player.bank.push(card);
        break;

      case 'action':
        // Handle action cards
        handleActionCard(room, player, card, targetData);
        break;

      case 'rent':
        // Handle rent cards
        handleRentCard(room, player, card, targetData);
        break;
    }

    player.cardsPlayedThisTurn++;
    
    // Check for winner
    const winner = checkWinner(room);
    if (winner) {
      room.winner = winner;
      room.phase = 'ended';
      io.to(roomId).emit('game-ended', { room, winner });
      return;
    }

    io.to(roomId).emit('card-played', { player, card, room, targetData });
  });

  // End turn
  socket.on('end-turn', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[room.currentPlayerIndex];
    if (player.id !== playerId) return;

    // Reset cards played
    player.cardsPlayedThisTurn = 0;

    // Move to next player
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
    room.turnPhase = 'draw';

    io.to(roomId).emit('turn-ended', { room, nextPlayer: room.players[room.currentPlayerIndex] });
  });

  // Pay rent/debt
  socket.on('pay-amount', ({ 
    roomId, 
    fromPlayerId, 
    toPlayerId, 
    amount, 
    cards 
  }: { 
    roomId: string; 
    fromPlayerId: string; 
    toPlayerId: string; 
    amount: number;
    cards: Card[];
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const fromPlayer = room.players.find((p) => p.id === fromPlayerId);
    const toPlayer = room.players.find((p) => p.id === toPlayerId);
    
    if (!fromPlayer || !toPlayer) return;

    // Remove cards from payer
    cards.forEach((card) => {
      const idx = fromPlayer.hand.findIndex((c) => c.id === card.id);
      if (idx !== -1) {
        fromPlayer.hand.splice(idx, 1);
      } else {
        const bankIdx = fromPlayer.bank.findIndex((c) => c.id === card.id);
        if (bankIdx !== -1) {
          fromPlayer.bank.splice(bankIdx, 1);
        }
      }
    });

    // Add cards to receiver's bank
    toPlayer.bank.push(...cards);

    io.to(roomId).emit('payment-made', { fromPlayer, toPlayer, amount, cards, room });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Find and clean up rooms
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex((p) => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('player-left', { player, room });
        }
      }
    });
  });
});

// Handle action cards
function handleActionCard(room: GameRoom, player: Player, card: Card, targetData?: any) {
  switch (card.actionType) {
    case 'passgo':
      // Draw 2 cards
      const { cards, remainingDeck } = drawCards(room.deck, 2);
      player.hand.push(...cards);
      room.deck = remainingDeck;
      break;

    case 'birthday':
      // All players pay $2M
      // This is handled by the client requesting payments
      break;

    case 'debtcollector':
      // One player pays $5M
      // This is handled by the client requesting payment
      break;

    case 'dealbreaker':
      // Steal complete set
      if (targetData?.targetPlayerId && targetData?.color) {
        const targetPlayer = room.players.find((p) => p.id === targetData.targetPlayerId);
        if (targetPlayer) {
          const targetSet = targetPlayer.properties.find((p) => p.color === targetData.color);
          const playerSet = player.properties.find((p) => p.color === targetData.color);
          
          if (targetSet && targetSet.isComplete && playerSet) {
            // Transfer all cards
            playerSet.cards.push(...targetSet.cards);
            playerSet.hasHouse = targetSet.hasHouse;
            playerSet.hasHotel = targetSet.hasHotel;
            playerSet.isComplete = true;
            
            // Clear target set
            targetSet.cards = [];
            targetSet.hasHouse = false;
            targetSet.hasHotel = false;
            targetSet.isComplete = false;
          }
        }
      }
      break;

    case 'slydeal':
      // Steal single property
      if (targetData?.targetPlayerId && targetData?.cardId && targetData?.color) {
        const targetPlayer = room.players.find((p) => p.id === targetData.targetPlayerId);
        if (targetPlayer) {
          const targetSet = targetPlayer.properties.find((p) => p.color === targetData.color);
          if (targetSet && !targetSet.isComplete) {
            const cardIndex = targetSet.cards.findIndex((c) => c.id === targetData.cardId);
            if (cardIndex !== -1) {
              const stolenCard = targetSet.cards.splice(cardIndex, 1)[0];
              targetSet.isComplete = checkPropertySetComplete(targetSet);
              
              const playerSet = player.properties.find((p) => p.color === targetData.color);
              if (playerSet) {
                playerSet.cards.push(stolenCard);
                playerSet.isComplete = checkPropertySetComplete(playerSet);
              }
            }
          }
        }
      }
      break;

    case 'forceddeal':
      // Swap properties
      if (targetData?.targetPlayerId && targetData?.myCardId && targetData?.theirCardId && 
          targetData?.myColor && targetData?.theirColor) {
        const targetPlayer = room.players.find((p) => p.id === targetData.targetPlayerId);
        if (targetPlayer) {
          const mySet = player.properties.find((p) => p.color === targetData.myColor);
          const theirSet = targetPlayer.properties.find((p) => p.color === targetData.theirColor);
          
          if (mySet && theirSet) {
            const myCardIdx = mySet.cards.findIndex((c) => c.id === targetData.myCardId);
            const theirCardIdx = theirSet.cards.findIndex((c) => c.id === targetData.theirCardId);
            
            if (myCardIdx !== -1 && theirCardIdx !== -1) {
              const myCard = mySet.cards.splice(myCardIdx, 1)[0];
              const theirCard = theirSet.cards.splice(theirCardIdx, 1)[0];
              
              mySet.cards.push(theirCard);
              theirSet.cards.push(myCard);
              
              mySet.isComplete = checkPropertySetComplete(mySet);
              theirSet.isComplete = checkPropertySetComplete(theirSet);
            }
          }
        }
      }
      break;

    case 'house':
      // Add house to complete set
      if (targetData?.color) {
        const propertySet = player.properties.find((p) => p.color === targetData.color);
        if (propertySet && propertySet.isComplete) {
          propertySet.hasHouse = true;
        }
      }
      break;

    case 'hotel':
      // Add hotel to set with house
      if (targetData?.color) {
        const propertySet = player.properties.find((p) => p.color === targetData.color);
        if (propertySet && propertySet.hasHouse) {
          propertySet.hasHotel = true;
        }
      }
      break;
  }
}

// Handle rent cards
function handleRentCard(room: GameRoom, player: Player, card: Card, targetData?: any) {
  // Rent calculation is done on client side
  // Server just validates and notifies
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
