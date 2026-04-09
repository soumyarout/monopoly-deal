import { useState, useEffect } from 'react';
import type { PendingAction, Player } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Ban, CheckCircle, Shield } from 'lucide-react';
import { getColorDisplayName } from '@/data/cards';
import type { PropertyColor } from '@/types/game';

interface ActionResponseModalProps {
  action: PendingAction;
  myPlayer: Player;
  actorName: string;
  onAccept: () => void;
  onJustSayNo: (cardId: string) => void;
}

const TIMEOUT_SECONDS = 15;

export function ActionResponseModal({ action, myPlayer, actorName, onAccept, onJustSayNo }: ActionResponseModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);

  useEffect(() => {
    setSecondsLeft(TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(interval); onAccept(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [action.id]);

  const jsnCards = myPlayer.hand.filter(c => c.actionType === 'sayno');
  const colorLabel = getColorDisplayName(action.targetData?.color as PropertyColor);
  const isCounter = action.jsnCount > 0 && action.jsnCount % 2 === 1;

  const actionLabel = action.type === 'dealbreaker' ? 'Deal Breaker'
    : action.type === 'slydeal' ? 'Sly Deal'
    : 'Forced Deal';

  const initialAlertText = action.type === 'dealbreaker'
    ? `${actorName} is stealing your complete ${colorLabel} set!`
    : action.type === 'slydeal'
    ? `${actorName} is using Sly Deal to steal one of your properties!`
    : `${actorName} wants to swap one of your properties using Forced Deal!`;

  return (
    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 text-white px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 flex-shrink-0" />
            <p className="font-bold text-sm">
              {isCounter ? 'Counter with Just Say No?' : `${actionLabel} Alert!`}
            </p>
          </div>
          <p className="text-red-200 text-xs leading-snug">
            {isCounter
              ? action.jsnCount === 1
                ? `${actorName} played Just Say No against your ${actionLabel}! Counter with yours?`
                : `${actorName} countered your Just Say No! Play another to cancel?`
              : initialAlertText
            }
          </p>

          {/* Countdown bar */}
          <div className="mt-3 bg-white/20 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-white h-full rounded-full transition-all duration-1000"
              style={{ width: `${(secondsLeft / TIMEOUT_SECONDS) * 100}%` }}
            />
          </div>
          <p className="text-red-200 text-[10px] mt-1 text-right">
            Auto-{isCounter ? 'cancels' : 'accepts'} in {secondsLeft}s
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 space-y-2">
          {jsnCards.length > 0 && (
            <Button
              onClick={() => onJustSayNo(jsnCards[0].id)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold h-12"
            >
              <Ban className="w-4 h-4 mr-2" />
              Play Just Say No!
            </Button>
          )}
          <Button
            onClick={onAccept}
            variant="outline"
            className="w-full h-10 text-sm text-gray-600"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            {isCounter
              ? `Accept (${actionLabel} goes through)`
              : action.type === 'dealbreaker'
              ? `Accept (give up ${colorLabel} set)`
              : 'Accept'}
          </Button>
        </div>
      </div>
    </div>
  );
}
