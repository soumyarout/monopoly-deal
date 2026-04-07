import { useState } from 'react';
import type { Player, Card, PendingPayment, PropertyColor } from '@/types/game';
import { CardComponent } from '@/components/cards/Card';
import { getColorDisplayName } from '@/data/cards';
import { cn } from '@/lib/utils';
import { Wallet, Home, AlertTriangle, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentModalProps {
  payment: PendingPayment;
  myPlayer: Player;  // debtor (payer)
  creditorName: string;
  onPay: (bankCardIds: string[], propertyCards: { color: PropertyColor; cardId: string }[]) => void;
  onJustSayNo: (cardId: string) => void;
}

const REASON_LABEL: Record<string, string> = {
  rent:          'Rent',
  debtcollector: 'Debt Collector',
  birthday:      "It's My Birthday",
};

export function PaymentModal({ payment, myPlayer, creditorName, onPay, onJustSayNo }: PaymentModalProps) {
  const [selectedBankIds, setSelectedBankIds]     = useState<Set<string>>(new Set());
  const [selectedProps, setSelectedProps]         = useState<{ color: PropertyColor; cardId: string }[]>([]);

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
    myPlayer.properties.flatMap(s => s.cards).reduce((s, c) => s + c.value, 0);

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

          {/* Property cards — cannot pay from complete sets (spec §6 clarification) */}
          {myPlayer.properties.some(s => s.cards.length > 0) && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-bold text-gray-700">Properties</p>
                <span className="text-xs text-gray-400 ml-auto">tap to select</span>
              </div>
              <div className="space-y-2">
                {myPlayer.properties.filter(s => s.cards.length > 0).map(set => (
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
            disabled={!canConfirm && totalSelected === 0 && hasAnyCards}
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
