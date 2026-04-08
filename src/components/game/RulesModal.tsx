import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RulesModalProps {
  onClose: () => void;
}

function SectionBlock({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
          <span>{emoji}</span> {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3 text-sm text-gray-700 space-y-2">{children}</div>}
    </div>
  );
}

function Rule({ label, text }: { label?: string; text: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-green-500 mt-0.5 flex-shrink-0">▸</span>
      <p>{label && <span className="font-semibold text-gray-900">{label}: </span>}{text}</p>
    </div>
  );
}

function CardRow({ name, value, count, effect }: { name: string; value: string; count: number; effect: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-bold text-gray-900 text-sm">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">×{count}</span>
          <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">💰{value}</span>
        </div>
      </div>
      <p className="text-xs text-gray-600">{effect}</p>
    </div>
  );
}

export function RulesModal({ onClose }: RulesModalProps) {
  const tabs = ['Overview', 'Actions', 'Properties', 'Payments', 'Edge Cases'];
  const [tab, setTab] = useState('Overview');

  return (
    <div className="fixed inset-0 bg-black/70 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh] overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="bg-green-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-base">Rules Reference</h2>
            <p className="text-green-200 text-xs">Monopoly Deal — quick guide</p>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm" className="text-white hover:bg-green-600 p-1 h-8 w-8">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto flex-shrink-0">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                tab === t
                  ? 'text-green-700 border-b-2 border-green-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">

          {tab === 'Overview' && (
            <>
              <SectionBlock title="Goal" emoji="🏆">
                <Rule text="Be the first player to complete 3 full property sets of different colors." />
                <Rule text="Win is checked after every action that modifies properties — not just at end of turn." />
              </SectionBlock>

              <SectionBlock title="Turn Structure" emoji="🔄">
                <Rule label="Draw" text="Draw 2 cards at the start of your turn. If you had 0 cards in hand at end of last turn, draw 5 instead." />
                <Rule label="Play" text="Play up to 3 cards in any combination: bank a card, play a property, or play an action." />
                <Rule label="Discard" text="If you have more than 7 cards in hand at end of turn, discard down to 7 (your choice)." />
                <Rule label="End Turn" text="Click End Turn when done. You don't have to use all 3 plays." />
              </SectionBlock>

              <SectionBlock title="What Counts as a Play" emoji="🃏">
                <Rule label="Costs 1 play" text="Banking a card as money, playing a property/wildcard, playing an action card." />
                <Rule label="Free (no play cost)" text="Moving/rearranging wildcards between your own property sets during your turn." />
                <Rule label="Out-of-turn reaction" text="Just Say No does not cost a play and can be used on anyone else's turn." />
              </SectionBlock>

              <SectionBlock title="Deck Size" emoji="📦">
                <Rule text="110 cards total: 28 properties, 11 wildcards, 13 rent, 20 money, and 34 action cards." />
                <Rule text="When the draw pile runs out, the discard pile is reshuffled to form a new draw pile." />
              </SectionBlock>
            </>
          )}

          {tab === 'Actions' && (
            <>
              <p className="text-xs text-gray-500 mb-1">All action cards can be banked as money instead of being played.</p>

              <CardRow
                name="Pass Go"
                value="1M" count={10}
                effect="Draw 2 extra cards from the draw pile immediately."
              />
              <CardRow
                name="It's My Birthday"
                value="2M" count={3}
                effect="All other players must pay you 2M each from their bank or properties."
              />
              <CardRow
                name="Debt Collector"
                value="3M" count={3}
                effect="Choose one player — they must pay you 5M from their bank or properties."
              />
              <CardRow
                name="Sly Deal"
                value="3M" count={3}
                effect="Steal one property or wildcard from any player's incomplete set. Cannot target complete sets."
              />
              <CardRow
                name="Forced Deal"
                value="3M" count={4}
                effect="Swap one of your properties with one property from another player's incomplete set. Each card goes to the set matching its own color."
              />
              <CardRow
                name="Deal Breaker"
                value="5M" count={2}
                effect="Steal an entire complete set (including any attached House/Hotel) from any player."
              />
              <CardRow
                name="Just Say No"
                value="4M" count={3}
                effect="Cancel any action played against you — including rent, Sly Deal, Forced Deal, Deal Breaker, Debt Collector, or Birthday. Does not cost a play. Can counter another Just Say No."
              />
              <CardRow
                name="Double the Rent"
                value="1M" count={2}
                effect="Play alongside a Rent card on the same turn to double the total rent charged. Costs 1 of your 3 plays."
              />
              <CardRow
                name="House"
                value="3M" count={3}
                effect="Attach to a complete property set to add +3M to its rent. Cannot be placed on Railroad (black) or Utility sets. One per set."
              />
              <CardRow
                name="Hotel"
                value="4M" count={2}
                effect="Attach to a complete set that already has a House to add +4M more rent. Cannot be placed on Railroad or Utility. One per set."
              />
            </>
          )}

          {tab === 'Properties' && (
            <>
              <SectionBlock title="Property Sets & Rent" emoji="🏠">
                <Rule text="Rent charged depends on how many cards of that color you own (1, 2, or full set)." />
                <Rule text="Each color has a required count for a full set (e.g. Brown = 2, Dark Blue = 2, Green = 3)." />
                <Rule text="House adds +3M, Hotel adds +4M on top of the full-set rent." />
              </SectionBlock>

              <SectionBlock title="Wildcards" emoji="🌈">
                <Rule text="Two-color wildcards can represent either of their two printed colors." />
                <Rule text="Multi-color wildcards (rainbow) can be any color." />
                <Rule label="Rearranging" text="You may freely move wildcards between your own sets on your turn — this is free and does not cost a play." />
                <Rule text="A wildcard belongs to exactly one color at a time." />
              </SectionBlock>

              <SectionBlock title="Rent Cards" emoji="💸">
                <Rule label="Two-color rent" text="Charge all opponents rent for one of the two colors on the card (you choose which color)." />
                <Rule label="Wild rent (any color)" text="Choose any one color you own — charge one player of your choice that amount." />
                <Rule text="Double the Rent can be played on the same turn as a rent card to double the amount." />
              </SectionBlock>

              <SectionBlock title="Complete Sets" emoji="✅">
                <Rule text="A complete set = the required number of cards of that color (properties + wildcards combined)." />
                <Rule text="Complete sets count toward the 3-set win condition." />
                <Rule text="Complete sets cannot be broken by Sly Deal or Forced Deal — only Deal Breaker can take them." />
                <Rule text="Complete sets are protected from payment — you cannot use cards from a complete set to pay debts." />
              </SectionBlock>
            </>
          )}

          {tab === 'Payments' && (
            <>
              <SectionBlock title="When You Must Pay" emoji="💰">
                <Rule text="When hit by a Rent card, Debt Collector, It's My Birthday, or any card effect that demands payment." />
                <Rule text="You choose which cards to surrender — the creditor cannot pick for you." />
              </SectionBlock>

              <SectionBlock title="Payment Rules" emoji="📋">
                <Rule label="Sources" text="Pay from your Bank (money + banked actions) first, then from your Property Area." />
                <Rule label="No change" text="If you owe 2M and only have a 3M card, you pay the 3M — no change is given." />
                <Rule label="Can't pay from hand" text="You never pay from cards in your hand." />
                <Rule label="Broke" text="If you have nothing on the table, you pay nothing. You stay in the game." />
                <Rule label="Properties → Creditor's area" text="Paid property cards go into the creditor's Property Area. Money goes into creditor's Bank." />
                <Rule label="Complete sets protected" text="You cannot use cards from a complete set to pay rent or debts." />
              </SectionBlock>

              <SectionBlock title="Just Say No in Payments" emoji="🚫">
                <Rule text="If you have a Just Say No, you can cancel the entire payment demand." />
                <Rule text="The creditor can then counter with their own Just Say No to restore the demand." />
                <Rule text="Chains can continue as long as both players have Just Say No cards." />
                <Rule text="For global actions (Birthday, Rent): each player's JSN only cancels it for themselves — others still pay." />
              </SectionBlock>
            </>
          )}

          {tab === 'Edge Cases' && (
            <>
              <SectionBlock title="Stealing Rules" emoji="🤏">
                <Rule label="Sly Deal & Forced Deal" text="Cannot target cards within a complete set. Only incomplete sets are valid targets." />
                <Rule label="Deal Breaker" text="Can only target complete sets (including any House/Hotel on the set)." />
                <Rule label="Forced Deal" text="You choose one of your cards to give; opponent gives one card back. Neither can be from a complete set." />
              </SectionBlock>

              <SectionBlock title="House & Hotel Restrictions" emoji="🏨">
                <Rule text="Houses and Hotels cannot be placed on Railroad (black) or Utility sets." />
                <Rule text="A set must be complete before you can place a House on it." />
                <Rule text="A set must have a House before you can place a Hotel on it." />
                <Rule text="Maximum one House and one Hotel per set." />
              </SectionBlock>

              <SectionBlock title="Wildcards in Sets" emoji="🔀">
                <Rule text="When a wildcard is placed into a set, it takes on that set's color." />
                <Rule text="When a wildcard is moved to a different set (free rearrangement), it becomes the new set's color." />
                <Rule text="Wildcards in complete sets are protected from Sly Deal and Forced Deal, same as regular properties." />
              </SectionBlock>

              <SectionBlock title="No Elimination" emoji="♾️">
                <Rule text="There is no player elimination. A player with no cards in front of them (broke) stays in the game." />
                <Rule text="A broke player starts their next turn drawing 2 cards as normal (or 5 if they had 0 in hand)." />
              </SectionBlock>

              <SectionBlock title="Draw Pile Empty" emoji="🗂️">
                <Rule text="When the draw pile is exhausted, shuffle the discard pile to create a new draw pile." />
              </SectionBlock>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 bg-gray-50">
          <Button onClick={onClose} className="w-full bg-green-600 hover:bg-green-700 text-white h-10 text-sm font-semibold">
            Back to Game
          </Button>
        </div>
      </div>
    </div>
  );
}
