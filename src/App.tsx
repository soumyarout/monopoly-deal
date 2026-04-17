import { useSocket } from '@/hooks/useSocket';
import type { PlayerReaction } from '@/hooks/useSocket';
import { lazy, Suspense } from 'react';
import type { EmojiClickData, Theme } from 'emoji-picker-react';
const EmojiPicker = lazy(() => import('emoji-picker-react'));
import { CurrencyContext, CURRENCY_SYMBOL } from '@/context/CurrencyContext';
import { MainMenu } from '@/components/game/MainMenu';
import { RoomLobby } from '@/components/game/RoomLobby';
import { GameTable } from '@/components/game/GameTable';
import { PlayerHand } from '@/components/game/PlayerHand';
import { PaymentModal } from '@/components/game/PaymentModal';
import { ActionResponseModal } from '@/components/game/ActionResponseModal';
import { RulesModal } from '@/components/game/RulesModal';
import { CardComponent } from '@/components/cards/Card';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowLeft, AlertCircle, Ban, Eye, PackageOpen, BookOpen, Crown } from 'lucide-react';
import { getColorClass, getColorDisplayName } from '@/data/cards';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { sounds, vibrate, getAudioSetting, setAudioSetting, isIOS } from '@/hooks/useSound';
import type { AudioSetting } from '@/hooks/useSound';

function App() {
  const [state, actions] = useSocket();
  const { room, currentPlayer, error, mustDiscard, pendingPayment, pendingAction, pendingJsnCounter, isSpectator, cardTakenNotification, jsnNotification, reactions, deckReshuffled } = state;
  const [showError, setShowError] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showReactionPanel, setShowReactionPanel] = useState(false);
  const [audioSetting, setAudioSettingState] = useState<AudioSetting>(() => getAudioSetting());

  const cycleAudioSetting = () => {
    // iOS doesn't support navigator.vibrate() — skip the haptics-only option
    const next: AudioSetting = isIOS
      ? (audioSetting === 'both' ? 'none' : 'both')
      : (audioSetting === 'both' ? 'haptics' : audioSetting === 'haptics' ? 'none' : 'both');
    setAudioSetting(next);
    setAudioSettingState(next);
    if (next === 'both' || next === 'haptics') vibrate(40);
  };
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevIsMyTurnRef = useRef(false);
  const prevPhasRef = useRef<string | null>(null);
  const prevPendingPayRef = useRef(false);
  const prevCardsPlayedRef = useRef(0);

  // Currency symbol driven by room version
  const currencySymbol = room ? (CURRENCY_SYMBOL[room.version] ?? 'M') : 'M';

  // Active game state — computed early so useEffects below can reference them
  const activePlayer  = room?.players[room.currentPlayerIndex];
  const isMyTurn      = activePlayer?.id === currentPlayer?.id;
  const myPlayerData  = room?.players.find(p => p.id === currentPlayer?.id);

  useEffect(() => {
    if (error) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Countdown timer driven by room.turnStartedAt — pauses while payments are pending
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!room || !room.turnTimeLimit || room.phase !== 'playing' || room.timerPaused) {
      // If paused, keep showing whatever secondsLeft was; if no limit, hide it
      if (!room?.turnTimeLimit || room?.phase !== 'playing') setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - room.turnStartedAt) / 1000);
      setSecondsLeft(Math.max(0, room.turnTimeLimit - elapsed));
    };
    tick();
    timerRef.current = setInterval(tick, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [room?.turnStartedAt, room?.turnTimeLimit, room?.phase, room?.timerPaused]);

  // Auto-dismiss card-taken notification after 5 seconds
  useEffect(() => {
    if (cardTakenNotification) {
      sounds.cardTaken();
      const timer = setTimeout(() => actions.clearCardTakenNotification(), 5000);
      return () => clearTimeout(timer);
    }
  }, [cardTakenNotification]);

  // Auto-dismiss JSN notification after 4 seconds
  useEffect(() => {
    if (jsnNotification) {
      sounds.jsnPlayed();
      const timer = setTimeout(() => actions.clearJsnNotification(), 4000);
      return () => clearTimeout(timer);
    }
  }, [jsnNotification]);

  // Sound + haptic: your turn starts
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current && room?.phase === 'playing') {
      sounds.yourTurn();
      vibrate([60, 40, 60]); // double-pulse = your turn
    }
    prevIsMyTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  // Sound + haptic: timer countdown
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 10 && isMyTurn) {
      if (secondsLeft <= 5) { sounds.timerUrgent(); vibrate(25); }
      else sounds.timerTick();
    }
  }, [secondsLeft]);

  // Sound + haptic: payment due
  useEffect(() => {
    if (pendingPayment && !prevPendingPayRef.current) {
      sounds.paymentDue();
      vibrate([80, 60, 80, 60, 120]); // urgent triple pattern
    }
    prevPendingPayRef.current = !!pendingPayment;
  }, [pendingPayment]);

  // Sound: card played (fires whenever cardsPlayedThisTurn increments)
  useEffect(() => {
    const count = myPlayerData?.cardsPlayedThisTurn ?? 0;
    if (count > prevCardsPlayedRef.current) sounds.cardPlayed();
    prevCardsPlayedRef.current = count;
  }, [myPlayerData?.cardsPlayedThisTurn]);

  // Sound + celebration: game ended
  useEffect(() => {
    if (room?.phase === 'ended' && prevPhasRef.current !== 'ended') {
      const isWinner = room.winner?.id === currentPlayer?.id;
      if (isWinner) sounds.winner(); else sounds.gameOver();
      // Show a brief celebration / reveal of winner's sets before the win screen
      setShowCelebration(true);
      const t = setTimeout(() => setShowCelebration(false), 4500);
      return () => clearTimeout(t);
    }
    prevPhasRef.current = room?.phase ?? null;
  }, [room?.phase]);

  if (!room) {
    return (
      <>
        <MainMenu
          onCreateRoom={actions.createRoom}
          onJoinRoom={actions.joinRoom}
          onWatchRoom={actions.watchRoom}
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
    const winnerSets = room.winner.properties.filter(s => s.isComplete);

    // Show celebration overlay first (4.5 s), then the win screen
    if (showCelebration) {
      return (
        <CurrencyContext.Provider value={currencySymbol}>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4 gap-6">
          {/* Winner banner */}
          <div className="text-center animate-bounce">
            <div className="text-6xl mb-2">🏆</div>
            <h2 className="text-3xl font-black text-yellow-400">{isWinner ? 'You Won!' : `${room.winner.name} Wins!`}</h2>
            <p className="text-white/60 text-sm mt-1">Collected {winnerSets.length} complete sets</p>
          </div>

          {/* Winner's complete property sets */}
          <div className="bg-white/10 rounded-2xl p-5 max-w-lg w-full border border-yellow-400/30">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-yellow-400" />
              <p className="text-yellow-300 font-bold text-sm uppercase tracking-wider">Winning Sets</p>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {winnerSets.map((set, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={cn('text-[9px] text-white font-bold px-2 py-0.5 rounded-full mb-1', getColorClass(set.color))}>
                    {getColorDisplayName(set.color)} ✓
                  </div>
                  <div className="flex gap-1">
                    {set.cards.map((card, ci) => (
                      <CardComponent key={ci} card={card} size="sm" />
                    ))}
                  </div>
                  {(set.hasHouse || set.hasHotel) && (
                    <div className="flex gap-1">{set.hasHouse && <span>🏠</span>}{set.hasHotel && <span>🏨</span>}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/40 text-xs animate-pulse">Showing results in a moment…</p>
        </div>
        </CurrencyContext.Provider>
      );
    }

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

          {/* Winner's sets preview */}
          {winnerSets.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-2 flex items-center justify-center gap-1">
                <Crown className="w-3 h-3" /> {room.winner.name}'s Winning Sets
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {winnerSets.map((set, i) => (
                  <div key={i} className={cn('text-[9px] text-white font-bold px-2 py-1 rounded-lg flex items-center gap-1', getColorClass(set.color))}>
                    {getColorDisplayName(set.color)} ({set.cards.length}✓)
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 mb-4">
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

          {/* Power Card Usage */}
          {(() => {
            const POWER_CARDS = [
              { key: 'dealbreaker'   as const, label: 'Deal Breaker', bg: 'bg-red-100 text-red-700' },
              { key: 'slydeal'       as const, label: 'Sly Deal',     bg: 'bg-orange-100 text-orange-700' },
              { key: 'forceddeal'    as const, label: 'Forced Deal',  bg: 'bg-blue-100 text-blue-700' },
              { key: 'sayno'         as const, label: 'Just Say No',  bg: 'bg-purple-100 text-purple-700' },
              { key: 'birthday'      as const, label: 'Birthday',     bg: 'bg-pink-100 text-pink-700' },
              { key: 'debtcollector' as const, label: 'Debt Coll.',   bg: 'bg-green-100 text-green-700' },
            ];
            const rows = room.players
              .map(p => ({ p, badges: POWER_CARDS.filter(pc => (p.powerCardStats?.[pc.key] ?? 0) > 0) }))
              .filter(r => r.badges.length > 0);
            if (rows.length === 0) return null;
            return (
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <h3 className="font-bold text-gray-700 mb-3">Power Card Usage</h3>
                <div className="space-y-2">
                  {rows.map(({ p, badges }) => (
                    <div key={p.id} className="flex items-start gap-2">
                      <span className="text-xs font-medium text-gray-600 min-w-[72px] pt-1 truncate">{p.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {badges.map(pc => (
                          <span key={pc.key} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', pc.bg)}>
                            {pc.label} ×{p.powerCardStats![pc.key]}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <Button onClick={actions.leaveRoom} className="w-full h-14 text-lg bg-green-500 hover:bg-green-600 text-white">
            <ArrowLeft className="w-5 h-5 mr-2" /> Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  // Resolve creditor info for payment modal
  const creditorPlayer = pendingPayment
    ? room.players.find(p => p.id === pendingPayment.creditorId)
    : undefined;
  const creditorName = creditorPlayer?.name ?? 'Opponent';

  // Resolve actor name for action response modal.
  // When jsnCount is odd, this player is the Deal Breaker actor receiving a counter-JSN —
  // so the "other person" label should be the responder, not themselves.
  // When counter (jsnCount odd) the modal is shown to the actor — show the victim's name (targetId).
  // When initial request (jsnCount even) the modal is shown to the victim — show the actor's name (actorId).
  const pendingActionIsCounter = pendingAction && pendingAction.jsnCount > 0 && pendingAction.jsnCount % 2 === 1;
  const actionActorName = pendingAction
    ? (room.players.find(p => p.id === (pendingActionIsCounter ? pendingAction.targetId : pendingAction.actorId))?.name ?? 'Opponent')
    : '';

  return (
    <CurrencyContext.Provider value={currencySymbol}>
    <div className="h-dvh bg-gray-900 flex flex-col overflow-hidden">
      {/* Header — safe-top pushes content below the notch/Dynamic Island */}
      <div className="bg-gray-800 px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0 safe-top">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-white font-bold text-sm">
            <span className="text-gray-400 text-xs">ROOM</span> {room.id}
          </div>
          <div className="text-gray-600">|</div>
          {isSpectator ? (
            <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
              <Eye className="w-3 h-3" /> Watching
            </span>
          ) : (
            <div className="text-gray-300 text-sm">
              <span className="text-gray-500 text-xs">TURN </span>
              <span className={isMyTurn ? 'text-yellow-400 font-bold' : 'text-white'}>
                {isMyTurn ? 'You' : activePlayer?.name}
              </span>
            </div>
          )}
          {room.pendingPayments.length > 0 && (
            <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full animate-pulse">
              Waiting: {room.pendingPayments
                .filter(pp => !pp.jsnState)
                .map(pp => room.players.find(p => p.id === pp.debtorId)?.name ?? '?')
                .join(', ')}
            </span>
          )}
          {room.pendingActions.length > 0 && (
            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full animate-pulse">
              Awaiting response…
            </span>
          )}
          {isMyTurn && room.timerPaused && room.turnTimeLimit > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1">
              ⏸ Paused
            </span>
          )}
          {isMyTurn && !room.timerPaused && secondsLeft !== null && (
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
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-[10px] tabular-nums hidden sm:inline">v{__APP_VERSION__}</span>

          {/* Audio / Haptics toggle */}
          <button
            onClick={cycleAudioSetting}
            title={isIOS
              ? (audioSetting === 'both' ? 'Sound on (haptics not supported on iOS)' : 'Sound off')
              : (audioSetting === 'both' ? 'Audio + Haptics on' : audioSetting === 'haptics' ? 'Haptics only' : 'Audio & Haptics off')}
            className="text-gray-400 hover:text-white text-sm px-1.5 py-1 rounded-md hover:bg-gray-700 transition-colors"
          >
            {audioSetting === 'both' ? '🔊' : audioSetting === 'haptics' ? '📳' : '🔇'}
          </button>

          {/* Reaction button — only shown in an active game */}
          {room?.phase === 'playing' && (
            <div className="relative">
              <Button
                onClick={() => setShowReactionPanel(v => !v)}
                variant="ghost" size="sm"
                className={cn('text-gray-400 hover:text-white text-base px-2', showReactionPanel && 'text-yellow-400')}
              >
                😊
              </Button>
              {showReactionPanel && (
                <>
                  {/* Click-away backdrop */}
                  <div className="fixed inset-0 z-[94]" onClick={() => setShowReactionPanel(false)} />
                  <div className="absolute right-0 top-9 z-[95]">
                    <Suspense fallback={<div className="bg-gray-800 rounded-2xl w-[300px] h-[380px] flex items-center justify-center text-gray-400 text-sm">Loading…</div>}>
                      <EmojiPicker
                        theme={'dark' as Theme}
                        onEmojiClick={(data: EmojiClickData) => {
                          actions.sendReaction(data.emoji);
                          setShowReactionPanel(false);
                        }}
                        searchPlaceholder="Search emoji…"
                        width={300}
                        height={380}
                        lazyLoadEmojis
                      />
                    </Suspense>
                  </div>
                </>
              )}
            </div>
          )}
          <Button onClick={() => setShowRules(true)} variant="ghost" size="sm" className="text-gray-400 hover:text-white text-xs px-2">
            <BookOpen className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Rules</span>
          </Button>
          <Button onClick={actions.leaveRoom} variant="ghost" size="sm" className="text-gray-400 hover:text-white text-xs px-2">
            Leave
          </Button>
        </div>
      </div>

      {/* Game table */}
      <div className="flex-1 min-h-0 p-2 overflow-hidden">
        <GameTable
          players={room.players}
          currentPlayerId={currentPlayer?.id || ''}
          activePlayerId={activePlayer?.id ?? ''}
          version={room.version}
          isMyTurn={isMyTurn && !isSpectator}
          onMoveWildcard={actions.moveWildcard}
          discardPile={room.discardPile}
          deckCount={room.deck.length}
        />
      </div>

      {/* Player hand — hidden for spectators */}
      {myPlayerData && !isSpectator && (
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

      {/* Spectator footer banner */}
      {isSpectator && (
        <div className="bg-blue-900/80 border-t border-blue-700 px-4 py-2 text-center flex-shrink-0">
          <span className="text-blue-200 text-sm flex items-center justify-center gap-2">
            <Eye className="w-4 h-4" /> You are watching this game
          </span>
        </div>
      )}

      {/* Payment modal — shown when this player owes money */}
      {pendingPayment && myPlayerData && (
        <PaymentModal
          payment={pendingPayment}
          myPlayer={myPlayerData}
          creditorName={creditorName}
          creditorPlayer={creditorPlayer}
          onPay={(bankCardIds, propertyCards) => actions.payAmount(pendingPayment.id, bankCardIds, propertyCards)}
          onJustSayNo={(cardId) => actions.justSayNo(pendingPayment.id, cardId)}
        />
      )}

      {/* Deal Breaker JSN response modal */}
      {pendingAction && myPlayerData && (
        <ActionResponseModal
          action={pendingAction}
          myPlayer={myPlayerData}
          actorName={actionActorName}
          onAccept={() => actions.respondToAction(pendingAction.id, 'accept')}
          onJustSayNo={(cardId) => actions.respondToAction(pendingAction.id, 'jsn', cardId)}
        />
      )}

      {/* JSN counter-opportunity banner (creditor countering debtor's JSN on a payment) */}
      {pendingJsnCounter && myPlayerData && (() => {
        const jsnCard = myPlayerData.hand.find(c => c.actionType === 'sayno');
        return (
          <div className="fixed inset-0 bg-black/75 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
              <div className="bg-purple-700 text-white px-4 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <Ban className="w-5 h-5" />
                  <p className="font-bold text-sm">Just Say No played against you!</p>
                </div>
                <p className="text-purple-200 text-xs">
                  {pendingJsnCounter.debtorName} cancelled your demand with Just Say No!
                  {jsnCard ? ' Counter with your own Just Say No?' : ''}
                </p>
              </div>
              <div className="p-4 space-y-2">
                {jsnCard && (
                  <Button
                    onClick={() => actions.counterJsn(pendingJsnCounter.paymentId, 'jsn', jsnCard.id)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Counter with Just Say No!
                  </Button>
                )}
                <Button
                  onClick={() => actions.counterJsn(pendingJsnCounter.paymentId, 'accept')}
                  variant="outline"
                  className="w-full h-10 text-sm text-gray-600"
                >
                  Accept — let Just Say No stand
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Card-taken notification modal (Sly Deal / Forced Deal victim) */}
      {cardTakenNotification && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xs w-full shadow-2xl overflow-hidden">
            <div className="bg-amber-500 text-white px-4 py-4 flex items-center gap-3">
              <PackageOpen className="w-6 h-6 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Card Taken!</p>
                <p className="text-amber-100 text-xs">
                  {cardTakenNotification.dealType === 'dealbreaker'
                    ? `${cardTakenNotification.takerName} used Deal Breaker`
                    : cardTakenNotification.dealType === 'slydeal'
                    ? `${cardTakenNotification.takerName} used Sly Deal`
                    : `${cardTakenNotification.takerName} used Forced Deal`}
                </p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-gray-700 text-sm mb-4">
                Your <span className="font-bold">{cardTakenNotification.cardName}</span> was taken.
              </p>
              <Button
                onClick={actions.clearCardTakenNotification}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold h-10"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* JSN notification toast */}
      {jsnNotification && (
        <div
          className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] max-w-sm w-full px-4"
          onClick={actions.clearJsnNotification}
        >
          <div className="bg-purple-700 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 cursor-pointer">
            <Ban className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-semibold leading-snug flex-1">{jsnNotification.message}</p>
            <span className="text-purple-300 text-xs">tap to dismiss</span>
          </div>
        </div>
      )}

      {/* Deck reshuffled toast */}
      {deckReshuffled && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[89] max-w-sm w-full px-4 pointer-events-none">
          <div className="bg-slate-700 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-lg">🔀</span>
            <p className="text-sm font-semibold leading-snug">Deck reshuffled from discard pile</p>
          </div>
        </div>
      )}

      {/* Rules reference modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* Error toast */}
      {showError && error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Floating emoji reactions */}
      <ReactionOverlay reactions={reactions} />
    </div>
    </CurrencyContext.Provider>
  );
}

// ─── Floating Reaction Bubbles ────────────────────────────────────────────────

function ReactionOverlay({ reactions }: { reactions: PlayerReaction[] }) {
  if (reactions.length === 0) return null;
  return (
    <>
      <style>{`
        @keyframes reactionFloat {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          70%  { opacity: 0.9; transform: translateY(-80px) scale(1.1); }
          100% { opacity: 0; transform: translateY(-120px) scale(0.9); }
        }
        .reaction-bubble {
          animation: reactionFloat 3.5s ease-out forwards;
        }
      `}</style>
      <div className="fixed bottom-40 right-4 z-[85] flex flex-col-reverse gap-2 pointer-events-none">
        {reactions.map(r => (
          <div
            key={r.id}
            className="reaction-bubble flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white text-sm font-semibold px-3 py-2 rounded-2xl shadow-xl border border-white/10 w-max"
          >
            <span className="text-2xl leading-none">{r.emoji}</span>
            <span className="text-xs text-white/80">{r.playerName}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default App;
