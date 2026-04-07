import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameRoom, Player, Card, GameVersion, PendingPayment, PendingAction, Spectator, PropertyColor } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';

const PERSISTENT_ID_KEY = 'mdeal-pid';
const ROOM_ID_KEY = 'mdeal-rid';

function getPersistentId(): string {
  let id = localStorage.getItem(PERSISTENT_ID_KEY);
  if (!id) { id = uuidv4(); localStorage.setItem(PERSISTENT_ID_KEY, id); }
  return id;
}

export interface CardTakenNotification {
  takerName: string;
  cardName: string;
  color?: string;
  dealType: string;
}

interface SocketState {
  connected: boolean;
  room: GameRoom | null;
  currentPlayer: Player | null;
  isSpectator: boolean;
  spectatorInfo: Spectator | null;
  error: string | null;
  mustDiscard: number;
  pendingPayment: PendingPayment | null; // payment this player owes
  pendingAction: PendingAction | null;   // deal breaker targeting this player
  pendingJsnCounter: { paymentId: string; debtorName: string } | null; // creditor counter-JSN opportunity
  cardTakenNotification: CardTakenNotification | null;
}

interface SocketActions {
  createRoom: (playerName: string, version: GameVersion, mode: 'single' | 'multi', aiCount?: number, turnTimeLimit?: number) => void;
  joinRoom: (playerName: string, roomCode: string) => void;
  watchRoom: (playerName: string, roomCode: string) => void;
  startGame: () => void;
  toggleReady: () => void;
  leaveRoom: () => void;
  addAIPlayer: () => void;
  removeAIPlayer: (aiPlayerId: string) => void;
  drawCards: () => void;
  playCard: (card: Card, targetData?: any) => void;
  endTurn: () => void;
  discardCards: (cards: Card[]) => void;
  payAmount: (paymentId: string, bankCardIds: string[], propertyCards: { color: PropertyColor; cardId: string }[]) => void;
  justSayNo: (paymentId: string, cardId: string) => void;
  counterJsn: (paymentId: string, response: 'jsn' | 'accept', cardId?: string) => void;
  respondToAction: (actionId: string, response: 'accept' | 'jsn', cardId?: string) => void;
  moveWildcard: (cardId: string, fromColor: PropertyColor, toColor: PropertyColor) => void;
  clearCardTakenNotification: () => void;
}

export function useSocket(): [SocketState, SocketActions] {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketState>({
    connected: false,
    room: null,
    currentPlayer: null,
    isSpectator: false,
    spectatorInfo: null,
    error: null,
    mustDiscard: 0,
    pendingPayment: null,
    pendingAction: null,
    pendingJsnCounter: null,
    cardTakenNotification: null,
  });

  useEffect(() => {
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isDevelopment ? 'http://localhost:3000' : window.location.origin;

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setState(p => ({ ...p, connected: true, error: null }));
      // Auto-rejoin room on reconnect
      const storedRoomId = localStorage.getItem(ROOM_ID_KEY);
      if (storedRoomId) {
        socket.emit('reconnect-room', {
          roomId: storedRoomId,
          persistentPlayerId: getPersistentId(),
        });
      }
    });

    socket.on('disconnect', () => setState(p => ({ ...p, connected: false })));
    socket.on('connect_error', () =>
      setState(p => ({ ...p, error: 'Failed to connect to server. Please make sure the server is running.' }))
    );

    socket.on('room-created', ({ room, player }: { room: GameRoom; player: Player }) => {
      localStorage.setItem(ROOM_ID_KEY, room.id);
      setState(p => ({ ...p, room, currentPlayer: player, isSpectator: false, spectatorInfo: null, error: null }));
    });

    socket.on('room-joined', ({ room, player }: { room: GameRoom; player: Player }) => {
      localStorage.setItem(ROOM_ID_KEY, room.id);
      setState(p => ({ ...p, room, currentPlayer: player, isSpectator: false, spectatorInfo: null, error: null }));
    });

    socket.on('reconnected', ({ room, player }: { room: GameRoom; player: Player }) => {
      localStorage.setItem(ROOM_ID_KEY, room.id);
      setState(p => {
        // Restore pendingPayment if this player is a debtor
        const pendingPayment = room.pendingPayments.find(pm => pm.debtorId === player.id && !pm.jsnState) ?? null;
        // Restore pendingAction if this player is the responder
        const pendingAction = room.pendingActions.find(a => a.responderId === player.id) ?? null;
        return { ...p, room, currentPlayer: player, isSpectator: false, spectatorInfo: null, error: null, pendingPayment, pendingAction };
      });
    });

    socket.on('room-watched', ({ room, spectator }: { room: GameRoom; spectator: Spectator }) => {
      localStorage.setItem(ROOM_ID_KEY, room.id);
      setState(p => ({ ...p, room, currentPlayer: null, isSpectator: true, spectatorInfo: spectator, error: null }));
    });

    socket.on('player-joined',        ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('player-updated',       ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('player-left',          ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('player-reconnected',   ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('player-disconnected',  ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('spectator-joined',     ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('spectator-left',       ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('game-started',         ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('cards-drawn',          ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('card-played',          ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('payment-made',         ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('all-payments-done',    ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('game-ended',           ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('room-updated',         ({ room }: { room: GameRoom }) => {
      setState(p => {
        // Re-derive pendingAction from updated room
        const pendingAction = p.currentPlayer
          ? (room.pendingActions.find(a => a.responderId === p.currentPlayer!.id) ?? null)
          : null;
        // Clear pendingJsnCounter if payment no longer has jsnState awaiting us
        const pendingJsnCounter = p.pendingJsnCounter
          ? (room.pendingPayments.find(pm =>
              pm.id === p.pendingJsnCounter!.paymentId &&
              pm.jsnState?.awaitingCounterFromId === p.currentPlayer?.id
            ) ? p.pendingJsnCounter : null)
          : null;
        return { ...p, room, pendingAction, pendingJsnCounter };
      });
    });

    socket.on('just-say-no-played', ({ room }: { room: GameRoom }) =>
      setState(p => ({ ...p, room, pendingPayment: null, pendingJsnCounter: null })));

    socket.on('must-discard', ({ count }: { count: number }) =>
      setState(p => ({ ...p, mustDiscard: count })));

    socket.on('turn-ended', ({ room }: { room: GameRoom }) =>
      setState(p => ({ ...p, room, mustDiscard: 0, pendingPayment: null, pendingAction: null, pendingJsnCounter: null })));

    // Payment request directed at this player
    socket.on('payment-request', ({ paymentId, room }: {
      paymentId: string; creditorId: string; creditorName: string;
      amount: number; reason: string; room: GameRoom;
    }) => {
      setState(p => {
        if (!p.currentPlayer) return p;
        const payment = room.pendingPayments.find(pm =>
          pm.id === paymentId && pm.debtorId === p.currentPlayer!.id
        );
        if (!payment) return { ...p, room };
        return { ...p, room, pendingPayment: payment };
      });
    });

    // Deal Breaker JSN request — target can accept or play JSN
    socket.on('deal-breaker-request', (payload: {
      actionId: string; actorName: string; color: string; room: GameRoom;
    }) => {
      setState(p => {
        const pendingAction = payload.room.pendingActions.find(a => a.id === payload.actionId) ?? null;
        return { ...p, room: payload.room, pendingAction };
      });
    });

    // Deal Breaker JSN counter — actor can counter the target's JSN
    socket.on('deal-breaker-counter', (payload: {
      actionId: string; actorName: string; color: string; jsnCount: number; room: GameRoom;
    }) => {
      setState(p => {
        const pendingAction = payload.room.pendingActions.find(a => a.id === payload.actionId) ?? null;
        return { ...p, room: payload.room, pendingAction };
      });
    });

    // JSN counter-opportunity on a payment (creditor can counter debtor's JSN)
    socket.on('jsn-counter-opportunity', ({ paymentId, debtorName, room }: {
      paymentId: string; debtorName: string; room: GameRoom;
    }) => {
      setState(p => ({ ...p, room, pendingJsnCounter: { paymentId, debtorName } }));
    });

    // Card taken notification (Sly Deal / Forced Deal victim)
    socket.on('card-taken', ({ takerName, cardName, color, dealType }: {
      takerName: string; cardName: string; color?: string; dealType: string;
    }) => {
      setState(p => ({ ...p, cardTakenNotification: { takerName, cardName, color, dealType } }));
    });

    socket.on('error', ({ message }: { message: string }) =>
      setState(p => ({ ...p, error: message })));

    return () => { socket.disconnect(); };
  }, []);

  const createRoom = useCallback((playerName: string, version: GameVersion, mode: 'single' | 'multi', aiCount?: number, turnTimeLimit = 60) => {
    socketRef.current?.emit('create-room', { playerName, version, mode, aiCount, turnTimeLimit, persistentPlayerId: getPersistentId() });
  }, []);

  const joinRoom = useCallback((playerName: string, roomCode: string) => {
    socketRef.current?.emit('join-room', { roomId: roomCode, playerName, persistentPlayerId: getPersistentId() });
  }, []);

  const watchRoom = useCallback((playerName: string, roomCode: string) => {
    socketRef.current?.emit('watch-room', { roomId: roomCode, playerName });
  }, []);

  const startGame = useCallback(() => {
    if (state.room) socketRef.current?.emit('start-game', { roomId: state.room.id });
  }, [state.room]);

  const toggleReady = useCallback(() => {
    if (state.room && state.currentPlayer)
      socketRef.current?.emit('player-ready', { roomId: state.room.id, playerId: state.currentPlayer.id });
  }, [state.room, state.currentPlayer]);

  const leaveRoom = useCallback(() => {
    localStorage.removeItem(ROOM_ID_KEY);
    socketRef.current?.disconnect();
    setTimeout(() => socketRef.current?.connect(), 100);
    setState({ connected: false, room: null, currentPlayer: null, isSpectator: false, spectatorInfo: null, error: null, mustDiscard: 0, pendingPayment: null, pendingAction: null, pendingJsnCounter: null, cardTakenNotification: null });
  }, []);

  const addAIPlayer = useCallback(() => {
    if (state.room && state.currentPlayer?.isHost)
      socketRef.current?.emit('add-ai-player', { roomId: state.room.id, playerId: state.currentPlayer.id });
  }, [state.room, state.currentPlayer]);

  const removeAIPlayer = useCallback((aiPlayerId: string) => {
    if (state.room && state.currentPlayer?.isHost)
      socketRef.current?.emit('remove-ai-player', { roomId: state.room.id, playerId: state.currentPlayer.id, aiPlayerId });
  }, [state.room, state.currentPlayer]);

  const drawCards = useCallback(() => {
    if (state.room && state.currentPlayer)
      socketRef.current?.emit('draw-cards', { roomId: state.room.id, playerId: state.currentPlayer.id });
  }, [state.room, state.currentPlayer]);

  const playCard = useCallback((card: Card, targetData?: any) => {
    if (state.room && state.currentPlayer)
      socketRef.current?.emit('play-card', { roomId: state.room.id, playerId: state.currentPlayer.id, cardId: card.id, targetData });
  }, [state.room, state.currentPlayer]);

  const endTurn = useCallback(() => {
    if (state.room && state.currentPlayer)
      socketRef.current?.emit('end-turn', { roomId: state.room.id, playerId: state.currentPlayer.id });
  }, [state.room, state.currentPlayer]);

  const discardCards = useCallback((cards: Card[]) => {
    if (state.room && state.currentPlayer)
      socketRef.current?.emit('discard-cards', { roomId: state.room.id, playerId: state.currentPlayer.id, cardIds: cards.map(c => c.id) });
  }, [state.room, state.currentPlayer]);

  const payAmount = useCallback((paymentId: string, bankCardIds: string[], propertyCards: { color: PropertyColor; cardId: string }[]) => {
    if (state.room)
      socketRef.current?.emit('pay-amount', { roomId: state.room.id, paymentId, bankCardIds, propertyCards });
    setState(p => ({ ...p, pendingPayment: null }));
  }, [state.room]);

  const justSayNo = useCallback((paymentId: string, cardId: string) => {
    if (state.room)
      socketRef.current?.emit('just-say-no', { roomId: state.room.id, paymentId, cardId });
    setState(p => ({ ...p, pendingPayment: null }));
  }, [state.room]);

  const counterJsn = useCallback((paymentId: string, response: 'jsn' | 'accept', cardId?: string) => {
    if (state.room)
      socketRef.current?.emit('counter-jsn', { roomId: state.room.id, paymentId, response, cardId });
    setState(p => ({ ...p, pendingJsnCounter: null }));
  }, [state.room]);

  const respondToAction = useCallback((actionId: string, response: 'accept' | 'jsn', cardId?: string) => {
    if (state.room)
      socketRef.current?.emit('respond-to-action', { roomId: state.room.id, actionId, response, cardId });
    setState(p => ({ ...p, pendingAction: null }));
  }, [state.room]);

  const moveWildcard = useCallback((cardId: string, fromColor: PropertyColor, toColor: PropertyColor) => {
    if (state.room && state.currentPlayer)
      socketRef.current?.emit('move-wildcard', {
        roomId: state.room.id, playerId: state.currentPlayer.id,
        cardId, fromColor, toColor,
      });
  }, [state.room, state.currentPlayer]);

  const clearCardTakenNotification = useCallback(() => {
    setState(p => ({ ...p, cardTakenNotification: null }));
  }, []);

  return [state, {
    createRoom, joinRoom, watchRoom, startGame, toggleReady, leaveRoom,
    addAIPlayer, removeAIPlayer, drawCards, playCard, endTurn,
    discardCards, payAmount, justSayNo, counterJsn, respondToAction, moveWildcard,
    clearCardTakenNotification,
  }];
}

export default useSocket;
