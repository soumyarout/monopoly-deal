import { useState } from 'react';
import type { Card, Player, PropertySet, GameVersion, PropertyColor } from '@/types/game';
import { PROPERTY_SET_RENT, PROPERTY_SET_REQUIREMENTS } from '@/types/game';
import { CardComponent } from '@/components/cards/Card';
import { getColorClass, getColorDisplayName, getPropertyNamesByColor } from '@/data/cards';
import { useCurrencyFmt } from '@/context/CurrencyContext';
import { cn } from '@/lib/utils';
import { Bot, Crown, X, Wallet, Home } from 'lucide-react';

const ALL_COLORS: PropertyColor[] = [
  'brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'black', 'utility',
];

/** Returns valid target colors when moving a wildcard (excludes the source set and complete sets). */
function validTargetColors(card: Card, fromColor: PropertyColor, playerProperties: { color: PropertyColor; isComplete: boolean }[]): PropertyColor[] {
  // Universal wildcard: both entries in colors[] are the same color (our data convention)
  const isUniversal = card.colors && card.colors.length >= 2
    && card.colors[0] === card.colors[card.colors.length - 1];
  const pool = isUniversal ? ALL_COLORS : (card.colors ?? []);
  return pool.filter(c => {
    if (c === fromColor) return false;
    const set = playerProperties.find(s => s.color === c);
    return !set?.isComplete; // cannot move into an already-complete set
  });
}

interface GameTableProps {
  players: Player[];
  currentPlayerId: string;
  activePlayerId: string;
  version: GameVersion;
  isMyTurn: boolean;
  onMoveWildcard: (cardId: string, fromColor: PropertyColor, toColor: PropertyColor) => void;
  discardPile: Card[];
  deckCount: number;
}

const CAR_LOGOS = ['🚗', '🏎️', '🚙', '🚐', '🚕'];
const CAR_COLORS = [
  'from-red-500 to-red-600',
  'from-blue-500 to-blue-600',
  'from-green-500 to-green-600',
  'from-yellow-500 to-yellow-600',
  'from-purple-500 to-purple-600',
];

export function GameTable({ players, currentPlayerId, activePlayerId, version, isMyTurn, onMoveWildcard, discardPile, deckCount }: GameTableProps) {
  const opponents = players.filter(p => p.id !== currentPlayerId);
  const mePlayer = players.find(p => p.id === currentPlayerId);
  const getPlayerIndex = (id: string) => players.findIndex(p => p.id === id);
  const [selectedOpponent, setSelectedOpponent] = useState<Player | null>(null);
  const [inspectSet, setInspectSet] = useState<PropertySet | null>(null);
  const [movingWildcard, setMovingWildcard] = useState<{ card: Card; fromColor: PropertyColor } | null>(null);

  function handleWildcardMove(toColor: PropertyColor) {
    if (!movingWildcard) return;
    onMoveWildcard(movingWildcard.card.id, movingWildcard.fromColor, toColor);
    setMovingWildcard(null);
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl overflow-hidden">

      {/* Opponents strip */}
      <div className="border-b border-white/10 bg-slate-900/70 px-2 pt-2 pb-1 flex-shrink-0">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
          Opponents <span className="normal-case text-white/25">(tap to inspect)</span>
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {opponents.length === 0 ? (
            <p className="text-white/30 text-xs italic py-1 px-1">No opponents yet</p>
          ) : (
            opponents.map(player => (
              <OpponentCard
                key={player.id}
                player={player}
                index={getPlayerIndex(player.id)}
                isActive={player.id === activePlayerId}
                onClick={() => setSelectedOpponent(player)}
              />
            ))
          )}
        </div>
      </div>

      {/* Opponent inspect modal */}
      {selectedOpponent && (
        <OpponentModal
          player={selectedOpponent}
          onClose={() => setSelectedOpponent(null)}
          onSetClick={set => setInspectSet(set)}
        />
      )}

      {/* Property info modal */}
      {inspectSet && (
        <PropertyInfoModal
          propertySet={inspectSet}
          version={version}
          onClose={() => setInspectSet(null)}
        />
      )}

      {/* Wildcard move modal */}
      {movingWildcard && (
        <WildcardMoveModal
          card={movingWildcard.card}
          fromColor={movingWildcard.fromColor}
          players={players}
          currentPlayerId={currentPlayerId}
          onMove={handleWildcardMove}
          onClose={() => setMovingWildcard(null)}
        />
      )}

      {/* Center: Deck (left) + Discard pile */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-white/10 flex-shrink-0">
        {/* Deck — M card with count badge */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <div className="relative">
            <div className="w-9 h-12 bg-gradient-to-br from-red-600 to-red-800 rounded-lg flex items-center justify-center shadow-lg border border-yellow-400/40">
              <span className="text-yellow-400 text-base font-black">M</span>
            </div>
            <span className="absolute -top-1.5 -right-1.5 bg-red-900 text-yellow-300 text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-yellow-400/40 leading-none">
              {deckCount}
            </span>
          </div>
          <span className="text-white/40 text-[9px]">DECK</span>
        </div>

        {/* Discard pile with animated stack */}
        <div className="flex flex-col items-center gap-0.5">
          <DiscardPileDisplay discardPile={discardPile} />
          <span className="text-white/40 text-[9px]">
            DISCARD{discardPile.length > 0 ? ` (${discardPile.length})` : ''}
          </span>
        </div>
      </div>

      {/* Current player's area */}
      {mePlayer && (
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          <p className={cn('text-[10px] uppercase tracking-wider mb-1.5', isMyTurn ? 'text-yellow-400 font-bold' : 'text-white/40')}>
            Your Area{isMyTurn ? ' — YOUR TURN' : ''}
          </p>
          <MyPlayerArea
            player={mePlayer}
            onSetClick={set => setInspectSet(set)}
            canMoveWildcard={isMyTurn}
            onWildcardClick={(card, fromColor) => setMovingWildcard({ card, fromColor })}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Opponent compact card ─── */
function OpponentCard({ player, index, isActive, onClick }: { player: Player; index: number; isActive: boolean; onClick: () => void }) {
  const fmt = useCurrencyFmt();
  const totalBankValue = player.bank.reduce((sum, c) => sum + c.value, 0);
  const totalProperties = player.properties.reduce((sum, s) => sum + s.cards.length, 0);
  const completeSets = player.properties.filter(s => s.isComplete).length;
  const carGradient = CAR_COLORS[index % CAR_COLORS.length];
  const carLogo = CAR_LOGOS[index % CAR_LOGOS.length];

  return (
    <div
      className={cn(
        'flex-shrink-0 w-36 rounded-xl p-2 border cursor-pointer active:scale-95 transition-all',
        isActive
          ? 'bg-yellow-400/10 border-yellow-400 hover:bg-yellow-400/20'
          : 'bg-white/10 border-white/10 hover:bg-white/20 hover:border-white/30'
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={cn('w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-sm flex-shrink-0', carGradient)}>
          {player.isAI ? <Bot className="w-3.5 h-3.5 text-white" /> : carLogo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-white text-[11px] font-semibold truncate leading-none">{player.name}</p>
            {isActive && <span className="text-[8px] font-bold text-yellow-400 animate-pulse flex-shrink-0">TURN</span>}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-green-400 text-[9px]">{fmt(`$${totalBankValue}M`)}</span>
            <span className="text-white/30 text-[9px]">·</span>
            <span className="text-blue-300 text-[9px]">{totalProperties} props</span>
            {completeSets > 0 && (
              <span className="text-yellow-400 text-[9px] font-bold flex items-center gap-0.5">
                <Crown className="w-2 h-2" />{completeSets}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-0.5 mb-1.5 min-h-[12px]">
        {player.properties.filter(s => s.cards.length > 0).map((set, idx) => (
          <div key={idx} className={cn('text-[7px] text-white font-bold px-1 py-0.5 rounded leading-none', getColorClass(set.color))}>
            {set.cards.length}{set.isComplete ? '✓' : ''}
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 items-center">
        {Array.from({ length: Math.min(player.hand.length, 6) }).map((_, i) => (
          <div key={i} className="w-2 h-3 bg-red-700 rounded-sm border border-red-600/50 flex-shrink-0" />
        ))}
        {player.hand.length > 6 && <span className="text-[8px] text-white/40 ml-0.5">+{player.hand.length - 6}</span>}
        {player.hand.length === 0 && <span className="text-[9px] text-white/30 italic">empty</span>}
      </div>
    </div>
  );
}

/* ─── My player area ─── */
interface MyPlayerAreaProps {
  player: Player;
  onSetClick: (set: PropertySet) => void;
  canMoveWildcard: boolean;
  onWildcardClick: (card: Card, fromColor: PropertyColor) => void;
}

function MyPlayerArea({ player, onSetClick, canMoveWildcard, onWildcardClick }: MyPlayerAreaProps) {
  const fmt = useCurrencyFmt();
  const totalBankValue = player.bank.reduce((sum, c) => sum + c.value, 0);
  const hasProperties = player.properties.some(s => s.cards.length > 0);
  const completeSets = player.properties.filter(s => s.isComplete).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-white/5 rounded-xl border border-white/10 p-2">
        <div className="flex items-center gap-1.5 mb-2">
          <Home className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Properties</span>
          {canMoveWildcard && (
            <span className="text-[9px] text-purple-400 ml-1">(tap wildcard to move)</span>
          )}
          {completeSets > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-yellow-400 font-semibold">
              <Crown className="w-3 h-3" />{completeSets} complete
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {player.properties.map((set, idx) =>
            set.cards.length > 0 ? (
              <PropertySetDisplay
                key={idx}
                propertySet={set}
                onSetClick={() => onSetClick(set)}
                canMoveWildcard={canMoveWildcard}
                onWildcardClick={card => onWildcardClick(card, set.color)}
              />
            ) : null
          )}
          {!hasProperties && <p className="text-white/25 text-xs italic py-1">No properties yet</p>}
        </div>
      </div>

      <div className="bg-white/5 rounded-xl border border-white/10 p-2">
        <div className="flex items-center gap-1.5 mb-2">
          <Wallet className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Cash</span>
          <span className="ml-auto text-[10px] font-bold text-green-400">{fmt(`$${totalBankValue}M`)}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {player.bank.map((card, idx) => <CardComponent key={idx} card={card} size="sm" />)}
          {player.bank.length === 0 && <p className="text-white/25 text-xs italic py-1">No cash yet</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Property set display ─── */
interface PropertySetDisplayProps {
  propertySet: PropertySet;
  onSetClick: () => void;
  canMoveWildcard: boolean;
  onWildcardClick: (card: Card) => void;
}

function PropertySetDisplay({ propertySet, onSetClick, canMoveWildcard, onWildcardClick }: PropertySetDisplayProps) {
  return (
    <div
      onClick={onSetClick}
      className="relative cursor-pointer hover:scale-[1.04] active:scale-95 transition-all select-none"
    >
      <div className={cn(
        'rounded-lg p-1 border-2',
        propertySet.isComplete
          ? 'border-green-500 bg-green-900/40 shadow-sm shadow-green-700/30'
          : 'border-white/10 bg-white/5'
      )}>
        <div className={cn('h-4 rounded flex items-center justify-center', getColorClass(propertySet.color))}>
          <span className="text-[8px] text-white font-bold truncate px-1">
            {getColorDisplayName(propertySet.color)}
          </span>
        </div>

        <div className="flex gap-0.5 mt-1">
          {propertySet.cards.map((card, idx) => {
            const isWild = card.isDualColor || card.isWildcard;
            if (isWild && canMoveWildcard) {
              return (
                <div
                  key={idx}
                  onClick={e => { e.stopPropagation(); onWildcardClick(card); }}
                  className="relative cursor-pointer group"
                  title="Tap to move this wildcard"
                >
                  <CardComponent card={card} size="sm" />
                  {/* Move hint badge */}
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-white text-[8px] font-bold">↔</span>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-purple-600/80 rounded-b text-[7px] text-white text-center font-bold py-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    MOVE
                  </div>
                </div>
              );
            }
            return <CardComponent key={idx} card={card} size="sm" />;
          })}
        </div>

        {(propertySet.hasHouse || propertySet.hasHotel) && (
          <div className="flex gap-0.5 mt-1 justify-center">
            {propertySet.hasHouse && <span className="text-xs">🏠</span>}
            {propertySet.hasHotel && <span className="text-xs">🏨</span>}
          </div>
        )}
        {propertySet.isComplete && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white text-[10px]">✓</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Wildcard move modal ─── */
interface WildcardMoveModalProps {
  card: Card;
  fromColor: PropertyColor;
  players: Player[];
  currentPlayerId: string;
  onMove: (toColor: PropertyColor) => void;
  onClose: () => void;
}

function WildcardMoveModal({ card, fromColor, players, currentPlayerId, onMove, onClose }: WildcardMoveModalProps) {
  const fmt = useCurrencyFmt();
  const me = players.find(p => p.id === currentPlayerId);
  const targets = validTargetColors(card, fromColor, me?.properties ?? []);

  return (
    <div className="fixed inset-0 bg-black/75 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-xs w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="bg-purple-600 text-white p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Move Wildcard</p>
            <p className="text-purple-200 text-xs mt-0.5">
              Currently in: <span className="font-semibold text-white">{getColorDisplayName(fromColor)}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card preview */}
        <div className="flex justify-center pt-4 pb-2">
          <CardComponent card={card} size="sm" />
        </div>

        {/* Target color list */}
        <div className="px-4 pb-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Move to color group:</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {targets.map(color => {
              const existingSet = me?.properties.find(p => p.color === color);
              const count = existingSet?.cards.length ?? 0;
              const required = PROPERTY_SET_REQUIREMENTS[color];
              const rentTable = PROPERTY_SET_RENT[color];
              const newCount = count + 1;
              const newRent = rentTable[Math.min(newCount - 1, rentTable.length - 1)] ?? 0;

              return (
                <button
                  key={color}
                  onClick={() => onMove(color)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 border-gray-100 hover:border-purple-400 hover:bg-purple-50 transition-all text-left"
                >
                  {/* Color swatch */}
                  <div className={cn('w-8 h-8 rounded-lg flex-shrink-0', getColorClass(color))} />

                  {/* Name + set progress */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{getColorDisplayName(color)}</p>
                    <p className="text-xs text-gray-500">
                      {count} → {newCount} of {required} cards
                      {newCount === required && <span className="ml-1 text-green-600 font-semibold">✓ completes set!</span>}
                    </p>
                  </div>

                  {/* Rent after move */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-green-600">{fmt(`$${newRent}M`)}</p>
                    <p className="text-[9px] text-gray-400">rent</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Opponent inspect modal ─── */
interface OpponentModalProps {
  player: Player;
  onClose: () => void;
  onSetClick: (set: PropertySet) => void;
}

function OpponentModal({ player, onClose, onSetClick }: OpponentModalProps) {
  const fmt = useCurrencyFmt();
  const totalBankValue = player.bank.reduce((sum, c) => sum + c.value, 0);
  const totalProperties = player.properties.reduce((sum, s) => sum + s.cards.length, 0);
  const completeSets = player.properties.filter(s => s.isComplete).length;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              {player.isAI ? <Bot className="w-5 h-5 text-white" /> : <span className="text-lg">🚗</span>}
            </div>
            <div>
              <p className="font-bold text-gray-900">{player.name}</p>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Wallet className="w-3 h-3 text-green-500" /> {fmt(`$${totalBankValue}M`)} bank</span>
                <span className="flex items-center gap-1"><Home className="w-3 h-3 text-blue-500" /> {totalProperties} properties</span>
                {completeSets > 0 && <span className="flex items-center gap-1 text-yellow-600 font-semibold"><Crown className="w-3 h-3" /> {completeSets} complete</span>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
          <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
            <div className="flex items-center gap-2 mb-2.5">
              <Home className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-bold text-gray-700">Properties</p>
              <span className="text-xs text-gray-400 ml-auto">(tap a set for rent info)</span>
              {completeSets > 0 && <span className="flex items-center gap-1 text-xs text-yellow-600 font-semibold ml-1"><Crown className="w-3.5 h-3.5" />{completeSets}</span>}
            </div>
            {totalProperties > 0 ? (
              <div className="flex flex-wrap gap-2">
                {player.properties.map((set, idx) =>
                  set.cards.length > 0 ? (
                    <button key={idx} onClick={() => onSetClick(set)}
                      className={cn('rounded-xl p-2 border-2 text-left transition-all hover:scale-[1.03] active:scale-95',
                        set.isComplete ? 'border-green-400 bg-green-50 hover:border-green-500' : 'border-gray-200 bg-white hover:border-blue-300')}>
                      <div className={cn('h-5 rounded-md flex items-center justify-center mb-1.5 px-2', getColorClass(set.color))}>
                        <span className="text-[9px] text-white font-bold">{getColorDisplayName(set.color)}{set.isComplete && ' ✓'}</span>
                      </div>
                      <div className="flex gap-1">
                        {set.cards.map((c, ci) => <CardComponent key={ci} card={c} size="sm" />)}
                      </div>
                      {(set.hasHouse || set.hasHotel) && (
                        <div className="flex gap-1 mt-1 justify-center">
                          {set.hasHouse && <span className="text-xs">🏠</span>}
                          {set.hasHotel && <span className="text-xs">🏨</span>}
                        </div>
                      )}
                    </button>
                  ) : null
                )}
              </div>
            ) : <p className="text-gray-400 italic text-sm">No properties on the table yet</p>}
          </div>

          <div className="border border-gray-100 rounded-xl p-3 bg-gray-50">
            <div className="flex items-center gap-2 mb-2.5">
              <Wallet className="w-4 h-4 text-green-500" />
              <p className="text-sm font-bold text-gray-700">Cash</p>
              <span className="ml-auto text-sm font-bold text-green-600">{fmt(`$${totalBankValue}M`)}</span>
            </div>
            {player.bank.length > 0
              ? <div className="flex flex-wrap gap-1.5">{player.bank.map((c, i) => <CardComponent key={i} card={c} size="sm" />)}</div>
              : <p className="text-gray-400 italic text-sm">No cash in bank yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Property info modal ─── */
interface PropertyInfoModalProps {
  propertySet: PropertySet;
  version: GameVersion;
  onClose: () => void;
}

function PropertyInfoModal({ propertySet, version, onClose }: PropertyInfoModalProps) {
  const fmt = useCurrencyFmt();
  const { color } = propertySet;
  const rentTable = PROPERTY_SET_RENT[color];
  const required = PROPERTY_SET_REQUIREMENTS[color];
  const owned = propertySet.cards.length;

  const regularCards = propertySet.cards.filter(c => !c.isDualColor && !c.isWildcard);
  const wildcardCards = propertySet.cards.filter(c => c.isDualColor || c.isWildcard);
  const allNames = getPropertyNamesByColor(color, version);

  const currentRent = owned > 0
    ? (rentTable[Math.min(owned - 1, rentTable.length - 1)] ?? 0)
      + (propertySet.hasHouse ? 3 : 0)
      + (propertySet.hasHotel ? 4 : 0)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/75 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-xs w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        <div className={cn('p-4 text-white', getColorClass(color))}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-lg leading-none">{getColorDisplayName(color)}</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm opacity-90">{owned} of {required} card{required !== 1 ? 's' : ''} owned</p>
          {owned > 0 && <p className="text-sm font-bold mt-0.5">Current rent: {fmt(`$${currentRent}M`)}</p>}
        </div>

        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            Property cards ({owned}/{required})
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {allNames.map(name => {
              const card = regularCards.find(c => c.name === name);
              return card ? (
                <div key={name} className="flex flex-col items-center gap-0.5">
                  <CardComponent card={card} size="sm" />
                  <span className="text-[8px] text-green-600 font-semibold">✓ owned</span>
                </div>
              ) : (
                <div key={name} className="w-16 h-24 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 px-1">
                  <span className="text-gray-300 text-base">?</span>
                  <span className="text-gray-400 text-[8px] text-center leading-tight font-medium">{name}</span>
                </div>
              );
            })}
            {wildcardCards.map((card, i) => (
              <div key={`wc-${i}`} className="flex flex-col items-center gap-0.5">
                <CardComponent card={card} size="sm" />
                <span className="text-[8px] text-purple-600 font-semibold">wildcard</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Rent table</p>
          <div className="space-y-1">
            {rentTable.map((rent, i) => {
              const count = i + 1;
              const isCurrent = count === owned;
              const isFull = count === required;
              return (
                <div key={i} className={cn('flex items-center justify-between px-3 py-1.5 rounded-lg text-sm',
                  isCurrent ? 'bg-blue-100 border-2 border-blue-400 font-bold' : 'bg-gray-50')}>
                  <span className={isCurrent ? 'text-blue-700' : 'text-gray-600'}>
                    {count} card{count !== 1 ? 's' : ''}
                    {isFull && <span className={cn('ml-1 text-xs', isCurrent ? 'text-blue-500' : 'text-green-600')}>(full set)</span>}
                  </span>
                  <span className={cn('font-bold tabular-nums', isCurrent ? 'text-blue-700' : 'text-gray-800')}>{fmt(`$${rent}M`)}</span>
                </div>
              );
            })}
            <div className={cn('flex items-center justify-between px-3 py-1.5 rounded-lg text-sm',
              propertySet.hasHouse ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 opacity-60')}>
              <span className={propertySet.hasHouse ? 'text-amber-700' : 'text-gray-500'}>
                🏠 + House
                {!propertySet.hasHouse && !propertySet.isComplete && <span className="ml-1 text-xs text-gray-400">(need full set)</span>}
              </span>
              <span className={cn('font-bold', propertySet.hasHouse ? 'text-amber-700' : 'text-gray-400')}>{fmt('+$3M')}</span>
            </div>
            <div className={cn('flex items-center justify-between px-3 py-1.5 rounded-lg text-sm',
              propertySet.hasHotel ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 opacity-60')}>
              <span className={propertySet.hasHotel ? 'text-purple-700' : 'text-gray-500'}>
                🏨 + Hotel
                {!propertySet.hasHotel && !propertySet.hasHouse && <span className="ml-1 text-xs text-gray-400">(need house first)</span>}
              </span>
              <span className={cn('font-bold', propertySet.hasHotel ? 'text-purple-700' : 'text-gray-400')}>{fmt('+$4M')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Discard pile animated stack with recent history ─── */
function DiscardPileDisplay({ discardPile }: { discardPile: Card[] }) {
  const [showHistory, setShowHistory] = useState(false);

  if (discardPile.length === 0) {
    return (
      <div className="w-9 h-12 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center">
        <span className="text-white/20 text-[8px]">empty</span>
      </div>
    );
  }

  const top = discardPile[discardPile.length - 1];
  // Show up to 3 previous cards as shadow layers
  const shadowCount = Math.min(discardPile.length - 1, 2);
  const shadowRots = [-8, 7];

  return (
    <>
      {/* clickable stack */}
      <div
        className="relative cursor-pointer"
        style={{ width: 36, height: 50 }}
        onClick={() => setShowHistory(true)}
        title="Click to see discard history"
      >
        {Array.from({ length: shadowCount }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-0 bg-gradient-to-br from-red-600 to-red-800 rounded-lg border border-yellow-400/30 shadow flex items-center justify-center"
            style={{ transform: `rotate(${shadowRots[i]}deg)` }}
          >
            <span className="text-yellow-400 text-sm font-black">M</span>
          </div>
        ))}
        <div className="absolute inset-0 rounded-lg overflow-hidden shadow-lg hover:ring-2 hover:ring-white/40 transition-all">
          <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 72, height: 108, pointerEvents: 'none' }}>
            <CardComponent card={top} size="sm" />
          </div>
        </div>
      </div>

      {/* History modal — last 10 cards */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setShowHistory(false)}>
          <div className="bg-slate-900 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="text-white font-bold text-sm">Recent Discards</p>
              <button onClick={() => setShowHistory(false)} className="text-white/50 hover:text-white text-xs">✕</button>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2 justify-center">
                {[...discardPile].reverse().slice(0, 10).map((card, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <CardComponent card={card} size="sm" />
                    {i === 0 && (
                      <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">★</span>
                    )}
                  </div>
                ))}
              </div>
              {discardPile.length > 10 && (
                <p className="text-center text-white/40 text-xs mt-3">+{discardPile.length - 10} more older cards</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GameTable;
