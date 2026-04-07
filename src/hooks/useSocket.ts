import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameRoom, Player, Card, GameVersion, PendingPayment, PropertyColor } from '@/types/game';

interface SocketState {
  connected: boolean;
  room: GameRoom | null;
  currentPlayer: Player | null;
  error: string | null;
  mustDiscard: number;
  pendingPayment: PendingPayment | null; // payment this player owes
}

interface SocketActions {
  createRoom: (playerName: string, version: GameVersion, mode: 'single' | 'multi', aiCount?: number, turnTimeLimit?: number) => void;
  joinRoom: (playerName: string, roomCode: string) => void;
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
  moveWildcard: (cardId: string, fromColor: PropertyColor, toColor: PropertyColor) => void;
}

export function useSocket(): [SocketState, SocketActions] {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<SocketState>({
    connected: false,
    room: null,
    currentPlayer: null,
    error: null,
    mustDiscard: 0,
    pendingPayment: null,
  });

  useEffect(() => {
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const serverUrl = isDevelopment ? 'http://localhost:3000' : window.location.origin;

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setState(p => ({ ...p, connected: true, error: null })));
    socket.on('disconnect', () => setState(p => ({ ...p, connected: false })));
    socket.on('connect_error', () =>
      setState(p => ({ ...p, error: 'Failed to connect to server. Please make sure the server is running.' }))
    );

    socket.on('room-created',    ({ room, player }: { room: GameRoom; player: Player }) =>
      setState(p => ({ ...p, room, currentPlayer: player, error: null })));
    socket.on('room-joined',     ({ room, player }: { room: GameRoom; player: Player }) =>
      setState(p => ({ ...p, room, currentPlayer: player, error: null })));
    socket.on('player-joined',   ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('player-updated',  ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('player-left',     ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('game-started',    ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('cards-drawn',     ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('card-played',     ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('payment-made',    ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('all-payments-done', ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('game-ended',      ({ room }: { room: GameRoom }) => setState(p => ({ ...p, room })));
    socket.on('just-say-no-played', ({ room }: { room: GameRoom }) =>
      setState(p => ({ ...p, room, pendingPayment: null })));

    socket.on('must-discard', ({ count }: { count: number }) =>
      setState(p => ({ ...p, mustDiscard: count })));

    socket.on('turn-ended', ({ room }: { room: GameRoom }) =>
      setState(p => ({ ...p, room, mustDiscard: 0, pendingPayment: null })));

    // Payment request directed at this player
    socket.on('payment-request', ({ paymentId, room }: {
      paymentId: string; creditorId: string; creditorName: string;
      amount: number; reason: string; room: GameRoom;
    }) => {
      setState(p => {
        if (!p.currentPlayer) return p;
        // Check if this payment is actually for us
        const payment = room.pendingPayments.find(pm =>
          pm.id === paymentId && pm.debtorId === p.currentPlayer!.id
        );
        if (!payment) return { ...p, room };
        return { ...p, room, pendingPayment: payment };
      });
    });

    socket.on('error', ({ message }: { message: string }) =>
      setState(p => ({ ...p, error: message })));

    return () => { socket.disconnect(); };
  }, []);

  const createRoom = useCallback((playerName: string, version: GameVersion, mode: 'single' | 'multi', aiCount?: number, turnTimeLimit = 60) => {
    socketRef.current?.emit('create-room', { playerName, version, mode, aiCount, turnTimeLimit });
  }, []);

  const joinRoom = useCallback((playerName: string, roomCode: string) => {
    socketRef.current?.emit('join-room', { roomId: roomCode, playerName });
  }, []);

  const startGame = useCallback(() => {
    if (state.room) socketRef.current?.emit('start-game', { roomId: state.room.id });
  }, [state.room]);

  const toggleReady = useCallback(() => {
    if (state.room && state.currentPlayer)
      socketRef.current?.emit('player-ready', { roomId: state.room.id, playerId: state.currentPlayer.id });
  }, [state.room, state.currentPlayer]);

  const leaveRoom = useCallback(() => {
    socketRef.current?.disconnect();
    setTimeout(() => socketRef.current?.connect(), 100);
    setState({ connected: false, room: null, currentPlayer: null, error: null, mustDiscard: 0, pendingPayment: null });
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

  const moveWildcard = useCallback((cardId: string, fromColor: PropertyColor, toColor: PropertyColor) => {
    if (state.room && state.currentPlayer)
      socketRef.current?.emit('move-wildcard', {
        roomId: state.room.id, playerId: state.currentPlayer.id,
        cardId, fromColor, toColor,
      });
  }, [state.room, state.currentPlayer]);

  return [state, {
    createRoom, joinRoom, startGame, toggleReady, leaveRoom,
    addAIPlayer, removeAIPlayer, drawCards, playCard, endTurn,
    discardCards, payAmount, justSayNo, moveWildcard,
  }];
}

export default useSocket;
