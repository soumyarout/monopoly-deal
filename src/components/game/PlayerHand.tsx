import { useState } from 'react';
import type { Card, GameRoom, PropertyColor } from '@/types/game';
import { PROPERTY_SET_RENT } from '@/types/game';
import { CardComponent } from '@/components/cards/Card';
import { getColorClass, getColorDisplayName } from '@/data/cards';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Play, X, Trash2 } from 'lucide-react';

interface PlayerHandProps {
  cards: Card[];
  onPlayCard: (card: Card, targetData?: any) => void;
  onEndTurn: () => void;
  onDiscardCards: (cards: Card[]) => void;
  cardsPlayedThisTurn: number;
  maxCardsPerTurn: number;
  isMyTurn: boolean;
  turnPhase: 'draw' | 'play' | 'end';
  onDrawCards: () => void;
  mustDiscard: number;
  room: GameRoom;
  currentPlayerId: string;
}

export function PlayerHand({
  cards, onPlayCard, onEndTurn, onDiscardCards,
  cardsPlayedThisTurn, maxCardsPerTurn,
  isMyTurn, turnPhase, onDrawCards, mustDiscard,
  room, currentPlayerId,
}: PlayerHandProps) {
  const [selectedCard, setSelectedCard]     = useState<Card | null>(null);
  const [discardSelection, setDiscardSelection] = useState<Card[]>([]);
  const [dropZoneActive, setDropZoneActive] = useState(false);

  const isDiscardMode = mustDiscard > 0;
  const canPlayCard   = isMyTurn && turnPhase === 'play' && cardsPlayedThisTurn < maxCardsPerTurn && !isDiscardMode;

  const me = room.players.find(p => p.id === currentPlayerId);

  const isCardPlayable = (card: Card): boolean => {
    if (!canPlayCard) return false;
    if (card.type === 'rent') {
      const rentColors = card.rentColors && card.rentColors.length > 0 ? card.rentColors : null;
      const available = rentColors
        ? rentColors.filter(c => (me?.properties.find(p => p.color === c)?.cards.length ?? 0) > 0)
        : (me?.properties.filter(s => s.cards.length > 0).map(s => s.color) ?? []);
      return available.length > 0;
    }
    return true;
  };

  const handleCardClick = (card: Card) => {
    if (isDiscardMode) {
      setDiscardSelection(prev => {
        const already = prev.find(c => c.id === card.id);
        if (already) return prev.filter(c => c.id !== card.id);
        if (prev.length >= mustDiscard) return prev;
        return [...prev, card];
      });
      return;
    }
    if (!isCardPlayable(card)) return;
    setSelectedCard(card);
  };

  const handlePlayCard = (targetData?: any) => {
    if (selectedCard) { onPlayCard(selectedCard, targetData); setSelectedCard(null); }
  };

  const handleConfirmDiscard = () => {
    if (discardSelection.length === mustDiscard) { onDiscardCards(discardSelection); setDiscardSelection([]); }
  };

  return (
    <div className={cn('rounded-t-2xl p-2 sm:p-4 shadow-2xl flex-shrink-0 safe-bottom', isDiscardMode ? 'bg-red-950' : 'bg-gray-900')}>

      {/* Discard banner */}
      {isDiscardMode && (
        <div className="bg-red-600 text-white rounded-xl px-4 py-2 mb-3 flex items-center justify-between">
          <span className="font-bold text-sm">
            ⚠ Too many cards! Discard {mustDiscard}
            <span className="ml-2 font-normal opacity-80">(max 7)</span>
          </span>
          <span className="text-sm font-medium">{discardSelection.length}/{mustDiscard}</span>
        </div>
      )}

      {/* Turn info bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-bold text-sm sm:text-base">Your Hand</h3>
          <span className={cn('text-xs', cards.length > 7 ? 'text-red-400 font-bold' : 'text-gray-400')}>
            ({cards.length}{cards.length > 7 ? ' ⚠' : ''})
          </span>
        </div>

        {isMyTurn && (
          <div className="flex flex-wrap items-center gap-2">
            {!isDiscardMode && (
              <span className="text-yellow-400 font-medium text-xs sm:text-sm">
                {cardsPlayedThisTurn}/{maxCardsPerTurn} played
              </span>
            )}
            {turnPhase === 'draw' && !isDiscardMode && (
              <Button onClick={onDrawCards} size="sm" className="bg-green-500 hover:bg-green-600 text-white">
                Draw Cards
              </Button>
            )}
            {turnPhase === 'play' && !isDiscardMode && (
              <Button onClick={onEndTurn} variant="outline" className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 h-10 px-5 text-sm sm:h-7 sm:px-2 sm:text-xs">
                End Turn
              </Button>
            )}
            {isDiscardMode && (
              <Button
                onClick={handleConfirmDiscard}
                size="sm"
                disabled={discardSelection.length !== mustDiscard}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Discard {mustDiscard}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Drag-to-play drop zone (desktop only) */}
      {canPlayCard && (
        <div
          className={cn(
            'mb-2 rounded-xl border-2 border-dashed py-2 text-center text-xs transition-all select-none hidden sm:block',
            dropZoneActive ? 'border-yellow-400 bg-yellow-400/10 text-yellow-300 scale-[1.01]' : 'border-white/20 text-white/30'
          )}
          onDragOver={e => { e.preventDefault(); setDropZoneActive(true); }}
          onDragLeave={() => setDropZoneActive(false)}
          onDrop={e => {
            e.preventDefault(); setDropZoneActive(false);
            const cardId = e.dataTransfer.getData('cardId');
            const card = cards.find(c => c.id === cardId);
            if (card) handleCardClick(card);
          }}
        >
          {dropZoneActive ? '🎯 Release to play' : '⬆ Drag a card here to play'}
        </div>
      )}

      {/* Cards */}
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        {cards.map((card, index) => {
          const isDiscardSelected = discardSelection.some(c => c.id === card.id);
          const playable = isCardPlayable(card);
          return (
            <div
              key={card.id}
              draggable={playable && !isDiscardMode}
              onDragStart={e => { e.dataTransfer.setData('cardId', card.id); e.dataTransfer.effectAllowed = 'move'; }}
              className={cn(
                'flex-shrink-0 transition-all duration-200',
                (playable || isDiscardMode) && 'hover:-translate-y-2 cursor-pointer',
                !playable && !isDiscardMode && 'opacity-50 cursor-not-allowed',
                playable && !isDiscardMode && 'sm:cursor-grab sm:active:cursor-grabbing',
                !isDiscardMode && selectedCard?.id === card.id && 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900',
                isDiscardMode && isDiscardSelected && 'ring-2 ring-red-500 ring-offset-2 ring-offset-red-950 -translate-y-2',
                isDiscardMode && !isDiscardSelected && 'opacity-60',
              )}
              style={{ marginLeft: index > 0 ? '-8px' : '0', zIndex: isDiscardSelected ? 50 : index }}
              onClick={() => handleCardClick(card)}
            >
              <CardComponent card={card} size="sm" isSelectable={playable || isDiscardMode}
                isSelected={isDiscardMode ? isDiscardSelected : selectedCard?.id === card.id} />
            </div>
          );
        })}
        {cards.length === 0 && <div className="text-gray-500 italic py-8 text-sm">No cards in hand</div>}
      </div>

      {/* Card action modal */}
      {selectedCard && !isDiscardMode && (
        <CardActionModal
          card={selectedCard}
          room={room}
          currentPlayerId={currentPlayerId}
          cardsPlayedThisTurn={cardsPlayedThisTurn}
          maxCardsPerTurn={maxCardsPerTurn}
          onClose={() => setSelectedCard(null)}
          onPlay={handlePlayCard}
        />
      )}
    </div>
  );
}

// ─── Card Action Modal ────────────────────────────────────────────────────────

interface CardActionModalProps {
  card: Card;
  room: GameRoom;
  currentPlayerId: string;
  cardsPlayedThisTurn: number;
  maxCardsPerTurn: number;
  onClose: () => void;
  onPlay: (targetData?: any) => void;
}

type ModalStep = 'main' | 'select-player' | 'select-their-property' | 'select-my-property' | 'select-color' | 'select-rent-target';

function CardActionModal({ card, room, currentPlayerId, cardsPlayedThisTurn, maxCardsPerTurn, onClose, onPlay }: CardActionModalProps) {
  const [step, setStep] = useState<ModalStep>('main');
  const [selectedPlayerId, setSelectedPlayerId]   = useState<string>('');
  const [selectedTheirCardId, setSelectedTheirCardId] = useState<string>('');
  const [selectedTheirColor, setSelectedTheirColor]   = useState<PropertyColor | ''>('');
  const [selectedColor, setSelectedColor]             = useState<PropertyColor | ''>('');
  const [useDoubleRent, setUseDoubleRent]             = useState(false);

  const me = room.players.find(p => p.id === currentPlayerId)!;
  const opponents = room.players.filter(p => p.id !== currentPlayerId);

  // ── Simple cards: play immediately ──
  const needsTarget = ['dealbreaker','slydeal','forceddeal','debtcollector'].includes(card.actionType ?? '');
  const isRent = card.type === 'rent';
  const isWildRent = isRent && (!card.rentColors || card.rentColors.length === 0);

  // ── Determine which colors I can rent for ──
  const availableRentColors: PropertyColor[] = isRent
    ? (card.rentColors && card.rentColors.length > 0
        ? card.rentColors.filter(c => (me?.properties.find(p => p.color === c)?.cards.length ?? 0) > 0)
        : (me?.properties.filter(s => s.cards.length > 0).map(s => s.color) ?? []))
    : [];

  // ── Double Rent integration ──
  // drCard: a Double Rent card in hand (excluding the card being played, in case it IS the doublerent)
  const drCard = isRent ? me?.hand.find(c => c.actionType === 'doublerent') : undefined;
  // canDoubleRent: player has the card AND has 2 plays remaining for this turn (rent + doublerent)
  const canDoubleRent = !!drCard && (cardsPlayedThisTurn + 2 <= maxCardsPerTurn);

  function handleMainPlay() {
    if (card.type === 'property' || card.type === 'cash') { onPlay(); return; }
    if (card.type === 'wild') { onPlay({ color: card.color }); return; }
    if (card.actionType === 'passgo') { onPlay(); return; }
    if (card.actionType === 'doublerent') { onPlay(); return; }
    if (card.actionType === 'birthday') { onPlay(); return; }
    if (card.actionType === 'house' || card.actionType === 'hotel') { setStep('select-color'); return; }
    if (needsTarget) { setStep('select-player'); return; }
    if (isRent) {
      // Always show color picker — player must consciously choose which color to charge
      setStep('select-color');
      return;
    }
    onPlay();
  }

  // ── Opponent's properties ──
  const theirPlayer = room.players.find(p => p.id === selectedPlayerId);

  // ── My properties for Forced Deal swap ──
  const myValidSets = me?.properties.filter(s => s.cards.length > 0) ?? [];

  function handlePlayerSelected(pid: string) {
    setSelectedPlayerId(pid);
    if (card.actionType === 'debtcollector') { onPlay({ targetPlayerId: pid }); onClose(); return; }
    if (card.actionType === 'dealbreaker') { setStep('select-their-property'); return; }
    if (card.actionType === 'slydeal') { setStep('select-their-property'); return; }
    if (card.actionType === 'forceddeal') { setStep('select-their-property'); return; }
    if (isWildRent) { onPlay({ color: selectedColor, targetPlayerId: pid }); onClose(); return; }
  }

  function handleTheirPropertySelected(color: PropertyColor, cardId: string) {
    setSelectedTheirColor(color); setSelectedTheirCardId(cardId);
    if (card.actionType === 'dealbreaker') {
      onPlay({ targetPlayerId: selectedPlayerId, color }); onClose(); return;
    }
    if (card.actionType === 'slydeal') {
      onPlay({ targetPlayerId: selectedPlayerId, color, cardId }); onClose(); return;
    }
    if (card.actionType === 'forceddeal') { setStep('select-my-property'); return; }
  }

  function handleMyPropertySelected(color: PropertyColor, cardId: string) {
    onPlay({
      targetPlayerId: selectedPlayerId,
      theirColor: selectedTheirColor, theirCardId: selectedTheirCardId,
      myColor: color, myCardId: cardId,
    });
    onClose();
  }

  function handleColorSelected(color: PropertyColor) {
    setSelectedColor(color);
    if (card.actionType === 'house' || card.actionType === 'hotel') {
      onPlay({ color }); onClose(); return;
    }
    if (isRent) {
      if (isWildRent) { setStep('select-rent-target'); }
      else {
        onPlay({
          color,
          useDoubleRent: canDoubleRent && useDoubleRent,
          doubleRentCardId: (canDoubleRent && useDoubleRent) ? drCard?.id : undefined,
        });
        onClose();
      }
      return;
    }
  }

  // ── Render ──
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {step !== 'main' && (
              <button onClick={() => setStep('main')} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
            )}
            <h3 className="text-base font-bold text-gray-800">{card.name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">

          {/* ── MAIN: card preview + play button ── */}
          {step === 'main' && (
            <div className="flex gap-4">
              <div className="flex-shrink-0"><CardComponent card={card} size="md" /></div>
              <div className="flex-1">
                <p className="text-gray-600 text-sm mb-4">{card.description}</p>
                {card.type === 'wild' && card.colors && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-500 mb-1">Place as color:</p>
                    <div className="flex flex-wrap gap-1">
                      {(card.colors.length >= 2 && card.colors[0] === card.colors[card.colors.length - 1]
                        ? (['brown','lightblue','pink','orange','red','yellow','green','blue','black','utility'] as PropertyColor[])
                        : card.colors
                      ).map(c => (
                        <button key={c} onClick={() => { onPlay({ color: c }); onClose(); }}
                          className={cn('px-3 py-1 rounded-lg text-xs font-bold text-white', getColorClass(c))}>
                          {getColorDisplayName(c)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {card.type !== 'wild' && (
                  <div className="flex flex-col gap-2">
                    <Button onClick={handleMainPlay} className="w-full bg-green-500 hover:bg-green-600 text-white">
                      <Play className="w-4 h-4 mr-2" />
                      {needsTarget || isRent ? 'Choose target →' : 'Play Card'}
                    </Button>
                    {(card.type === 'action' || card.type === 'rent') && (
                      <Button
                        onClick={() => { onPlay({ bankAsCard: true }); onClose(); }}
                        variant="outline"
                        className="w-full border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                      >
                        Bank as ${card.value}M cash
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SELECT PLAYER ── */}
          {step === 'select-player' && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-3">Choose an opponent:</p>
              <div className="space-y-2">
                {opponents.map(p => {
                  const validSets = p.properties.filter(s => s.cards.length > 0 && (card.actionType === 'dealbreaker' ? s.isComplete : !s.isComplete));
                  const hasValidTarget = card.actionType === 'debtcollector' || validSets.length > 0;
                  return (
                    <button key={p.id} disabled={!hasValidTarget}
                      onClick={() => handlePlayerSelected(p.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                        hasValidTarget
                          ? 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                          : 'border-gray-100 opacity-40 cursor-not-allowed'
                      )}>
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {card.actionType === 'debtcollector'
                          ? `Bank: $${p.bank.reduce((s,c)=>s+c.value,0)}M`
                          : `${validSets.length} eligible set(s)`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SELECT THEIR PROPERTY ── */}
          {step === 'select-their-property' && theirPlayer && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">
                {card.actionType === 'dealbreaker' ? 'Choose a complete set to steal:' : 'Choose a property to take:'}
              </p>
              <p className="text-xs text-gray-400 mb-3">{theirPlayer.name}'s properties</p>
              <div className="space-y-3">
                {theirPlayer.properties.filter(s =>
                  s.cards.length > 0 && (card.actionType === 'dealbreaker' ? s.isComplete : !s.isComplete)
                ).map(set => (
                  <div key={set.color}>
                    <div className={cn('text-[10px] text-white font-bold px-2 py-0.5 rounded mb-1 inline-block', getColorClass(set.color))}>
                      {getColorDisplayName(set.color)}{set.isComplete ? ' ✓ complete' : ''}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {card.actionType === 'dealbreaker'
                        ? (
                          <button onClick={() => handleTheirPropertySelected(set.color, set.cards[0].id)}
                            className="flex gap-1 p-1 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
                            {set.cards.map(c => <CardComponent key={c.id} card={c} size="sm" />)}
                          </button>
                        )
                        : set.cards.map(c => (
                          <div key={c.id} onClick={() => handleTheirPropertySelected(set.color, c.id)}
                            className="cursor-pointer hover:scale-110 transition-transform">
                            <CardComponent card={c} size="sm" />
                          </div>
                        ))
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SELECT MY PROPERTY (Forced Deal swap) ── */}
          {step === 'select-my-property' && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Choose your property to give away:</p>
              <div className="space-y-3">
                {myValidSets.map(set => (
                  <div key={set.color}>
                    <div className={cn('text-[10px] text-white font-bold px-2 py-0.5 rounded mb-1 inline-block', getColorClass(set.color))}>
                      {getColorDisplayName(set.color)}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {set.cards.map(c => (
                        <div key={c.id} onClick={() => handleMyPropertySelected(set.color, c.id)}
                          className="cursor-pointer hover:scale-110 transition-transform">
                          <CardComponent card={c} size="sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SELECT COLOR (Rent, House, Hotel) ── */}
          {step === 'select-color' && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-3">
                {isRent ? 'Charge rent for which color?' : `Attach ${card.name} to which set?`}
              </p>

              {/* Double Rent toggle — only for rent cards */}
              {isRent && drCard && (
                <div
                  onClick={() => canDoubleRent && setUseDoubleRent(v => !v)}
                  className={cn(
                    'mb-3 p-3 rounded-xl border-2 flex items-center gap-3 select-none',
                    canDoubleRent ? 'cursor-pointer' : 'cursor-not-allowed opacity-40',
                    canDoubleRent && useDoubleRent ? 'bg-purple-50 border-purple-400' : 'border-gray-200',
                    canDoubleRent && !useDoubleRent && 'hover:border-purple-300'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                    canDoubleRent && useDoubleRent ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                  )}>
                    {canDoubleRent && useDoubleRent && <span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold', canDoubleRent ? 'text-gray-800' : 'text-gray-400')}>
                      Double the Rent!
                      {!canDoubleRent && <span className="font-normal text-xs text-gray-400 ml-1">(need 2 plays remaining)</span>}
                    </p>
                    <p className="text-xs text-gray-500">Uses 1 extra play · charges ×2 rent</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(isRent ? availableRentColors : me?.properties.filter(s =>
                    card.actionType === 'house' ? (s.isComplete && !s.hasHouse)
                    : (s.isComplete && s.hasHouse && !s.hasHotel)
                  ).map(s => s.color) ?? []
                ).map(color => {
                  const set = me?.properties.find(p => p.color === color);
                  const rentTable = PROPERTY_SET_RENT[color];
                  const cards_count = set?.cards.length ?? 0;
                  const baseRent = rentTable[Math.min(cards_count - 1, rentTable.length - 1)] ?? 0;
                  const withHouse = set?.hasHouse ? baseRent + 3 : baseRent;
                  const finalRent = (canDoubleRent && useDoubleRent) ? withHouse * 2 : withHouse;
                  const rentDisplay = isRent ? `$${finalRent}M rent` : '';
                  return (
                    <button key={color} onClick={() => handleColorSelected(color)}
                      className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-3">
                      <div className={cn('w-6 h-6 rounded', getColorClass(color))} />
                      <span className="font-semibold text-gray-800">{getColorDisplayName(color)}</span>
                      {rentDisplay && (
                        <span className={cn('ml-auto font-bold text-sm', canDoubleRent && useDoubleRent ? 'text-purple-600' : 'text-green-600')}>
                          {rentDisplay}{canDoubleRent && useDoubleRent ? ' ×2' : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SELECT RENT TARGET (Wild Rent: pick one player) ── */}
          {step === 'select-rent-target' && isWildRent && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">
                Charge {getColorDisplayName(selectedColor as PropertyColor)} rent
                {canDoubleRent && useDoubleRent ? ' (×2)' : ''} from:
              </p>
              <div className="space-y-2 mt-3">
                {opponents.map(p => (
                  <button key={p.id} onClick={() => {
                    onPlay({
                      color: selectedColor,
                      targetPlayerId: p.id,
                      useDoubleRent: canDoubleRent && useDoubleRent,
                      doubleRentCardId: (canDoubleRent && useDoubleRent) ? drCard?.id : undefined,
                    });
                    onClose();
                  }}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all">
                    <p className="font-semibold text-gray-800">{p.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default PlayerHand;
