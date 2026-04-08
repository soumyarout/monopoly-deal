import { useState } from 'react';
import type { Player, Card, PendingPayment, PropertyColor, PropertySet } from '@/types/game';
import { CardComponent } from '@/components/cards/Card';
import { getColorDisplayName, getColorClass } from '@/data/cards';
import { cn } from '@/lib/utils';
import { Wallet, Home, AlertTriangle, Ban, Lock, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentModalProps {
  payment: PendingPayment;
  myPlayer: Player;  // debtor (payer)
  creditorName: string;
  creditorPlayer?: Player; // show their cards for reference
  onPay: (bankCardIds: string[], propertyCards: { color: PropertyColor; cardId: string }[]) => void;
  onJustSayNo: (cardId: string) => void;
}

const REASON_LABEL: Record<string, string> = {
  rent:          'Rent',
  debtcollector: 'Debt Collector',
  birthday:      "It's My Birthday",
};

/** Greedily auto-select cash-first, then properties, to cover the debt. */
function autoSelectPayment(
  bank: Card[],
  properties: PropertySet[],
  amount: number,
): { bankIds: Set<string>; propCards: { color: PropertyColor; cardId: string }[] } {
  const bankIds = new Set<string>();
  let total = 0;

  // Bank first (ascending value)
  for (const card of [...bank].sort((a, b) => a.value - b.value)) {
    if (total >= amount) break;
    bankIds.add(card.id);
    total += card.value;
  }

  // Properties second (incomplete sets only, ascending value)
  const propCards: { color: PropertyColor; cardId: string }[] = [];
  if (total < amount) {
    const propPool = properties
      .filter(s => !s.isComplete && s.cards.length > 0)
      .flatMap(s => s.cards.map(c => ({ color: s.color as PropertyColor, cardId: c.id, value: c.value })))
      .sort((a, b) => a.value - b.value);
    for (const p of propPool) {
      if (total >= amount) break;
      propCards.push({ color: p.color, cardId: p.cardId });
      total += p.value;
    }
  }

  return { bankIds, propCards };
}

export function PaymentModal({ payment, myPlayer, creditorName, creditorPlayer, onPay, onJustSayNo }: PaymentModalProps) {
  const [selectedBankIds, setSelectedBankIds]     = useState<Set<string>>(
    () => autoSelectPayment(myPlayer.bank, myPlayer.properties, payment.amount).bankIds
  );
  const [selectedProps, setSelectedProps]         = useState<{ color: PropertyColor; cardId: string }[]>(
    () => autoSelectPayment(myPlayer.bank, myPlayer.properties, payment.amount).propCards
  );
  const [showCreditor, setShowCreditor]           = useState(false);

  const jsnCard = myPlayer.hand.find(c => c.actionType === 'sayno');

  const totalSelected =
    myPlayer.bank.filter(c => selectedBankIds.has(c.id)).reduce((s, c) => s + c.value, 0) +
    selectedProps.reduce((s, sp) => {
      const set = myPlayer.properties.find(p => p.color === sp.color);
      const card = set?.cards.find(c => c.id === sp.cardId);
      return s + (card?.value ?? 0);
    }, 0);

  const totalAvailable =
    myPlayer.bank.reduce((s, c) => s + c.value, 0) +
    myPlayer.properties.filter(s => !s.isComplete).flatMap(s => s.cards).reduce((s, c) => s + c.value, 0);

  // Player can pay what they have if insufficient (spec §6)
  const canConfirm = totalSelected >= payment.amount || totalSelected >= totalAvailable;

  function toggleBankCard(card: Card) {
    setSelectedBankIds(prev => {
      const next = new Set(prev);
      next.has(card.id) ? next.delete(card.id) : next.add(card.id);
      return next;
    });
  }

  function togglePropertyCard(color: PropertyColor, cardId: string) {
    setSelectedProps(prev => {
      const exists = prev.find(p => p.cardId === cardId);
      if (exists) return prev.filter(p => p.cardId !== cardId);
      return [...prev, { color, cardId }];
    });
  }

  function handleConfirm() {
    onPay([...selectedBankIds], selectedProps);
  }

  const hasAnyCards = myPlayer.bank.length > 0 || myPlayer.properties.some(s => s.cards.length > 0);

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="bg-red-600 text-white px-4 py-3 rounded-t-2xl sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">
                {REASON_LABEL[payment.reason] ?? 'Payment Required'}
              </p>
              <p className="text-red-200 text-xs">
                {creditorName} demands <span className="font-bold text-white">${payment.amount}M</span>
              </p>
            </div>
            <div className="text-right">
              <p className={cn('text-lg font-black', totalSelected >= payment.amount ? 'text-green-300' : 'text-white')}>
                ${totalSelected}M
              </p>
              <p className="text-red-200 text-xs">of ${payment.amount}M</p>
            </div>
          </div>

          {/* Just Say No button */}
          {jsnCard && (
            <button
              onClick={() => onJustSayNo(jsnCard.id)}
              className="mt-2 w-full bg-white/20 hover:bg-white/30 border border-white/40 rounded-xl py-1.5 px-3 flex items-center justify-center gap-2 text-sm font-bold transition-colors"
            >
              <Ban className="w-4 h-4" />
              Play "Just Say No!" and cancel this demand
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Creditor's cards — collapsible reference view */}
          {creditorPlayer && (
            <div className="border border-blue-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowCreditor(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
              >
                <Eye className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-xs font-semibold text-blue-700 flex-1">{creditorName}'s cards (view for strategy)</span>
                {showCreditor ? <ChevronUp className="w-3.5 h-3.5 text-blue-400" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-400" />}
              </button>
              {showCreditor && (
                <div className="p-3 space-y-2 bg-white">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Wallet className="w-3 h-3" />
                    <span>Bank: <strong>${creditorPlayer.bank.reduce((s, c) => s + c.value, 0)}M</strong></span>
                  </div>
                  {creditorPlayer.properties.some(s => s.cards.length > 0) && (
                    <div className="space-y-1">
                      {creditorPlayer.properties.filter(s => s.cards.length > 0).map(set => (
                        <div key={set.color} className="flex flex-wrap gap-1 items-center">
                          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', getColorClass(set.color), set.color === 'yellow' || set.color === 'lightblue' ? 'text-black' : 'text-white')}>
                            {getColorDisplayName(set.color)}{set.isComplete ? ' ✓' : ''}
                          </span>
                          {set.cards.map(c => <CardComponent key={c.id} card={c} size="sm" />)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!hasAnyCards && (
            <p className="text-center text-gray-500 italic py-4">
              You have nothing to pay with — confirm to pay $0.
            </p>
          )}

          {/* Bank cards */}
          {myPlayer.bank.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-green-600" />
                <p className="text-sm font-bold text-gray-700">Cash (Bank)</p>
                <span className="text-xs text-gray-400 ml-auto">tap to select</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {myPlayer.bank.map(card => (
                  <div
                    key={card.id}
                    onClick={() => toggleBankCard(card)}
                    className={cn(
                      'cursor-pointer transition-all rounded-lg',
                      selectedBankIds.has(card.id)
                        ? 'ring-2 ring-red-500 ring-offset-1 -translate-y-1'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    )}
                  >
                    <CardComponent card={card} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Property cards — complete sets are protected, only incomplete sets can be used */}
          {myPlayer.properties.some(s => s.cards.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-bold text-gray-700">Properties</p>
                <span className="text-xs text-gray-400 ml-auto">tap to select</span>
              </div>
              <div className="space-y-2">
                {myPlayer.properties.filter(s => s.cards.length > 0 && !s.isComplete).map(set => (
                  <div key={set.color}>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span>{getColorDisplayName(set.color)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {set.cards.map(card => {
                        const isSelected = selectedProps.some(p => p.cardId === card.id);
                        return (
                          <div
                            key={card.id}
                            onClick={() => togglePropertyCard(set.color, card.id)}
                            className={cn(
                              'cursor-pointer transition-all rounded-lg',
                              isSelected
                                ? 'ring-2 ring-red-500 ring-offset-1 -translate-y-1'
                                : 'hover:scale-105 opacity-80 hover:opacity-100'
                            )}
                          >
                            <CardComponent card={card} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {myPlayer.properties.filter(s => s.isComplete).map(set => (
                  <div key={set.color} className="flex items-center gap-2 opacity-50 py-1">
                    <Lock className="w-3 h-3 text-green-600 flex-shrink-0" />
                    <span className="text-xs text-gray-500">{getColorDisplayName(set.color)} — complete set (protected)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4">
          {totalAvailable < payment.amount && (
            <p className="text-xs text-amber-600 mb-2 text-center">
              You can't fully pay — select all you have and confirm.
            </p>
          )}
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              'w-full h-12 text-sm font-bold',
              canConfirm ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-200 text-gray-400'
            )}
          >
            {hasAnyCards
              ? `Pay $${totalSelected}M${totalSelected < payment.amount ? ` (short $${payment.amount - totalSelected}M)` : ''}`
              : 'Confirm (nothing to pay)'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
