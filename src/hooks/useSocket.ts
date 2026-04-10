import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameRoom, Player, Card, GameVersion, PendingPayment, PendingAction, Spectator, PropertyColor, AISkillLevel } from '@/types/game';
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
  pendingPayment: PendingPayment | null;
  pendingAction: PendingAction | null;
  pendingJsnCounter: { paymentId: string; debtorName: string } | null;
  cardTakenNotification: CardTakenNotification | null;
  jsnNotification: { message: string } | null;
}

interface SocketActions {
  createRoom: (playerName: string, version: GameVersion, mode: 'single' | 'multi', aiCount?: number, turnTimeLimit?: number, aiSkillLevel?: AISkillLevel) => void;
  joinRoom: (playerName: string, roomCode: string) => void;
  watchRoom: (playerName: string, roomCode: string) => void;
  startGame: () => void;
  toggleReady: () => void;
  leaveRoom: () => void;
  addAIPlayer: (aiSkillLevel?: AISkillLevel) => void;
  removeAIPlayer: (aiPlayerId: string) => void;
  drawCards: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playCard: (card: Card, targetData?: any) => void;
  endTurn: () => void;
  discardCards: (cards: Card[]) => void;
  payAmount: (paymentId: string, bankCardIds: string[], propertyCards: { color: PropertyColor; cardId: string }[]) => void;
  justSayNo: (paymentId: string, cardId: string) => void;
  counterJsn: (paymentId: string, response: 'jsn' | 'accept', cardId?: string) => void;
  respondToAction: (actionId: string, response: 'accept' | 'jsn', cardId?: string) => void;
  moveWildcard: (cardId: string, fromColor: PropertyColor, toColor: PropertyColor) => void;
  clearCardTakenNotification: () => void;
  clearJsnNotification: () => void;
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
    jsnNotification: null,
  });

  useEffect(() => {
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isDevelopment ? 'http://localhost:3000' : window.location.origin;

    const socket = io(serverUrl, {
      transports: ['websocket'],   // WebSocket-only: avoids polling→WS upgrade disconnect
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setState(p => ({ ...p, connected: true, error: null }));
      const storedRoomId = localStorage.getItem(ROOM_ID_KEY);
      if (storedRoomId) {
        socket.emit('reconnect-room', { roomId: storedRoomId, persistentPlayerId: getPersistentId() });
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
        const pendingPayment = room.pendingPayments.find(pm => pm.debtorId === player.id && !pm.jsnState) ?? null;
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
    socket.on('payment-made', ({ room }: { room: GameRoom }) => {
      setState(p => {
        // Re-derive: if player still has an unpaid payment, keep showing it
        const pendingPayment = p.currentPlayer
          ? (room.pendingPayments.find(pm => pm.debtorId === p.currentPlayer!.id && !pm.jsnState) ?? null)
          : null;
        return { ...p, room, pendingPayment };
      });
    });
    socket.on('all-payments-done',    ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room, pendingPayment: null })));
    socket.on('game-ended',           ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('room-updated',         ({ room }: { room: GameRoom }) => {
      setState(p => {
        const pendingAction = p.currentPlayer
          ? (room.pendingActions.find(a => a.responderId === p.currentPlayer!.id) ?? null)
          : null;
        const pendingJsnCounter = p.pendingJsnCounter
          ? (room.pendingPayments.find(pm =>
              pm.id === p.pendingJsnCounter!.paymentId &&
              pm.jsnState?.awaitingCounterFromId === p.currentPlayer?.id
            ) ? p.pendingJsnCounter : null)
          : null;
        return { ...p, room, pendingAction, pendingJsnCounter };
      });
    });

    socket.on('just-say-no-played', ({ room }: { room: GameRoom }) => {
      setState(p => {
        // Re-derive: debtor may still owe from a previous rent that JSN didn't cancel
        const pendingPayment = p.currentPlayer
          ? (room.pendingPayments.find(pm => pm.debtorId === p.currentPlayer!.id && !pm.jsnState) ?? null)
          : null;
        return { ...p, room, pendingPayment, pendingJsnCounter: null };
      });
    });

    socket.on('must-discard', ({ count }: { count: number }) =>
      setState(p => ({ ...p, mustDiscard: count })));

    socket.on('turn-ended', ({ room }: { room: GameRoom }) =>
      setState(p => ({ ...p, room, mustDiscard: 0, pendingPayment: null, pendingAction: null, pendingJsnCounter: null })));

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

    socket.on('deal-breaker-request', (payload: {
      actionId: string; actorName: string; color: string; room: GameRoom;
    }) => {
      setState(p => {
        const pendingAction = payload.room.pendingActions.find(a => a.id === payload.actionId) ?? null;
        return { ...p, room: payload.room, pendingAction };
      });
    });

    socket.on('deal-breaker-counter', (payload: {
      actionId: string; actorName: string; color: string; jsnCount: number; room: GameRoom;
    }) => {
      setState(p => {
        const pendingAction = payload.room.pendingActions.find(a => a.id === payload.actionId) ?? null;
        return { ...p, room: payload.room, pendingAction };
      });
    });

    socket.on('jsn-counter-opportunity', ({ paymentId, debtorName, room }: {
      paymentId: string; debtorName: string; room: GameRoom;
    }) => {
      setState(p => ({ ...p, room, pendingJsnCounter: { paymentId, debtorName } }));
    });

    socket.on('card-taken', ({ takerName, cardName, color, dealType }: {
      takerName: string; cardName: string; color?: string; dealType: string;
    }) => {
      setState(p => ({ ...p, cardTakenNotification: { takerName, cardName, color, dealType } }));
    });

    // Notification when someone plays Just Say No cancelling your action/demand
    socket.on('jsn-notification', ({ message }: { message: string }) => {
      setState(p => ({ ...p, jsnNotification: { message } }));
    });

    socket.on('error', ({ message }: { message: string }) =>
      setState(p => ({ ...p, error: message })));

    return () => { socket.disconnect(); };
  }, []);

  const createRoom = useCallback((playerName: string, version: GameVersion, mode: 'single' | 'multi', aiCount?: number, turnTimeLimit = 60, aiSkillLevel: AISkillLevel = 'medium') => {
    socketRef.current?.emit('create-room', { playerName, version, mode, aiCount, turnTimeLimit, aiSkillLevel, persistentPlayerId: getPersistentId() });
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
    setState({ connected: false, room: null, currentPlayer: null, isSpectator: false, spectatorInfo: null, error: null, mustDiscard: 0, pendingPayment: null, pendingAction: null, pendingJsnCounter: null, cardTakenNotification: null, jsnNotification: null });
  }, []);

  const addAIPlayer = useCallback((aiSkillLevel?: AISkillLevel) => {
    if (state.room && state.currentPlayer?.isHost)
      socketRef.current?.emit('add-ai-player', { roomId: state.room.id, playerId: state.currentPlayer.id, aiSkillLevel: aiSkillLevel ?? state.room.aiSkillLevel ?? 'medium' });
  }, [state.room, state.currentPlayer]);

  const removeAIPlayer = useCallback((aiPlayerId: string) => {
    if (state.room && state.currentPlayer?.isHost)
      socketRef.current?.emit('remove-ai-player', { roomId: state.room.id, playerId: state.currentPlayer.id, aiPlayerId });
  }, [state.room, state.currentPlayer]);

  const drawCards = useCallback(() => {
    if (state.room && state.currentPlayer)
      socketRef.current?.emit('draw-cards', { roomId: state.room.id, playerId: state.currentPlayer.id });
  }, [state.room, state.currentPlayer]);

  const playCard = useCallback((card: Card, targetData?: unknown) => {
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

  const clearJsnNotification = useCallback(() => {
    setState(p => ({ ...p, jsnNotification: null }));
  }, []);

  return [state, {
    createRoom, joinRoom, watchRoom, startGame, toggleReady, leaveRoom,
    addAIPlayer, removeAIPlayer, drawCards, playCard, endTurn,
    discardCards, payAmount, justSayNo, counterJsn, respondToAction, moveWildcard,
    clearCardTakenNotification, clearJsnNotification,
  }];
}

export default useSocket;
