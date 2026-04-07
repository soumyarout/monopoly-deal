import { useSocket } from '@/hooks/useSocket';
import { MainMenu } from '@/components/game/MainMenu';
import { RoomLobby } from '@/components/game/RoomLobby';
import { GameTable } from '@/components/game/GameTable';
import { PlayerHand } from '@/components/game/PlayerHand';
import { PaymentModal } from '@/components/game/PaymentModal';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowLeft, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

function App() {
  const [state, actions] = useSocket();
  const { room, currentPlayer, error, mustDiscard, pendingPayment } = state;
  const [showError, setShowError] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Countdown timer driven by room.turnStartedAt
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!room || !room.turnTimeLimit || room.phase !== 'playing') {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - room.turnStartedAt) / 1000);
      setSecondsLeft(Math.max(0, room.turnTimeLimit - elapsed));
    };
    tick();
    timerRef.current = setInterval(tick, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [room?.turnStartedAt, room?.turnTimeLimit, room?.phase]);

  if (!room) {
    return (
      <>
        <MainMenu
          onCreateRoom={actions.createRoom}
          onJoinRoom={actions.joinRoom}
          connected={state.connected}
        />
        {showError && error && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}
      </>
    );
  }

  if (room.phase === 'lobby') {
    return (
      <RoomLobby
        room={room}
        currentPlayer={currentPlayer!}
        onStartGame={actions.startGame}
        onLeaveRoom={actions.leaveRoom}
        onToggleReady={actions.toggleReady}
        onAddAI={actions.addAIPlayer}
        onRemoveAI={actions.removeAIPlayer}
      />
    );
  }

  if (room.phase === 'ended' && room.winner) {
    const isWinner = room.winner.id === currentPlayer?.id;
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-8 text-center">
          <div className={cn('w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6', isWinner ? 'bg-yellow-400' : 'bg-gray-200')}>
            <Trophy className={cn('w-12 h-12', isWinner ? 'text-yellow-800' : 'text-gray-500')} />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{isWinner ? 'You Won!' : 'Game Over'}</h2>
          <p className="text-gray-600 mb-6">
            {isWinner ? 'Congratulations! You collected 3 complete property sets!' : `${room.winner.name} won the game!`}
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <h3 className="font-bold text-gray-700 mb-2">Final Standings</h3>
            <div className="space-y-2">
              {[...room.players]
                .sort((a, b) => b.properties.filter(p => p.isComplete).length - a.properties.filter(p => p.isComplete).length)
                .map((player, idx) => (
                  <div key={player.id} className={cn('flex items-center justify-between p-2 rounded-lg', player.id === room.winner?.id ? 'bg-yellow-100' : 'bg-white')}>
                    <span className="font-medium">{idx + 1}. {player.name}</span>
                    <span className="text-sm text-gray-500">{player.properties.filter(p => p.isComplete).length} complete sets</span>
                  </div>
                ))}
            </div>
          </div>
          <Button onClick={actions.leaveRoom} className="w-full h-14 text-lg bg-green-500 hover:bg-green-600 text-white">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  // Active game
  const activePlayer  = room.players[room.currentPlayerIndex];
  const isMyTurn      = activePlayer?.id === currentPlayer?.id;
  const myPlayerData  = room.players.find(p => p.id === currentPlayer?.id);

  // Resolve creditor name for payment modal
  const creditorName = pendingPayment
    ? (room.players.find(p => p.id === pendingPayment.creditorId)?.name ?? 'Opponent')
    : '';

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-white font-bold text-sm">
            <span className="text-gray-400 text-xs">ROOM</span> {room.id}
          </div>
          <div className="text-gray-600">|</div>
          <div className="text-gray-300 text-sm">
            <span className="text-gray-500 text-xs">TURN </span>
            <span className={isMyTurn ? 'text-yellow-400 font-bold' : 'text-white'}>
              {isMyTurn ? 'You' : activePlayer?.name}
            </span>
          </div>
          {room.pendingPayments.length > 0 && (
            <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full animate-pulse">
              Awaiting payment…
            </span>
          )}
          {isMyTurn && secondsLeft !== null && (
            <span className={cn(
              'text-xs font-bold tabular-nums px-2 py-0.5 rounded-full',
              secondsLeft <= 10
                ? 'bg-red-500 text-white animate-pulse'
                : secondsLeft <= 20
                ? 'bg-orange-400 text-white'
                : 'bg-gray-700 text-gray-200'
            )}>
              ⏱ {secondsLeft}s
            </span>
          )}
        </div>
        <Button onClick={actions.leaveRoom} variant="ghost" size="sm" className="text-gray-400 hover:text-white text-xs px-2">
          Leave
        </Button>
      </div>

      {/* Game table */}
      <div className="flex-1 min-h-0 p-2 overflow-hidden">
        <GameTable
          players={room.players}
          currentPlayerId={currentPlayer?.id || ''}
          version={room.version}
          isMyTurn={isMyTurn}
          onMoveWildcard={actions.moveWildcard}
        />
      </div>

      {/* Player hand */}
      {myPlayerData && (
        <PlayerHand
          cards={myPlayerData.hand}
          onPlayCard={actions.playCard}
          onEndTurn={actions.endTurn}
          onDiscardCards={actions.discardCards}
          cardsPlayedThisTurn={myPlayerData.cardsPlayedThisTurn}
          maxCardsPerTurn={3}
          isMyTurn={isMyTurn}
          turnPhase={room.turnPhase}
          onDrawCards={actions.drawCards}
          mustDiscard={mustDiscard}
          room={room}
          currentPlayerId={currentPlayer?.id ?? ''}
        />
      )}

      {/* Payment modal — shown when this player owes money */}
      {pendingPayment && myPlayerData && (
        <PaymentModal
          payment={pendingPayment}
          myPlayer={myPlayerData}
          creditorName={creditorName}
          onPay={(bankCardIds, propertyCards) => actions.payAmount(pendingPayment.id, bankCardIds, propertyCards)}
          onJustSayNo={(cardId) => actions.justSayNo(pendingPayment.id, cardId)}
        />
      )}

      {/* Error toast */}
      {showError && error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}
    </div>
  );
}

export default App;
