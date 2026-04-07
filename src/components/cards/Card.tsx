import type { Card as CardType, PropertyColor } from '@/types/game';
import { getColorClass, getColorDisplayName } from '@/data/cards';
import { cn } from '@/lib/utils';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showBack?: boolean;
}

const colorIcons: Record<PropertyColor, string> = {
  brown: '🏚️',
  lightblue: '🏠',
  pink: '🏩',
  orange: '🏭',
  red: '🏢',
  yellow: '🏨',
  green: '🏦',
  blue: '🏰',
  black: '🚂',
  utility: '💡',
};

const actionIcons: Record<string, string> = {
  dealbreaker: '💥',
  debtcollector: '💰',
  forceddeal: '🔄',
  slydeal: '🥷',
  birthday: '🎂',
  passgo: '🎫',
  house: '🏠',
  hotel: '🏨',
  sayno: '🚫',
  rent: '💵',
};

export function CardComponent({ 
  card, 
  onClick, 
  isSelectable = false, 
  isSelected = false,
  size = 'md',
  showBack = false
}: CardProps) {
  const sizeClasses = {
    sm: 'w-16 h-24 text-[8px]',
    md: 'w-24 h-36 text-[10px]',
    lg: 'w-32 h-48 text-xs',
  };

  if (showBack) {
    return (
      <div 
        className={cn(
          sizeClasses[size],
          'rounded-lg shadow-lg cursor-pointer transition-transform hover:scale-105',
          'bg-gradient-to-br from-red-700 via-red-600 to-red-800',
          'border-2 border-yellow-400 flex items-center justify-center'
        )}
        onClick={onClick}
      >
        <div className="text-yellow-400 font-bold text-lg">M</div>
      </div>
    );
  }

  const renderCardContent = () => {
    switch (card.type) {
      case 'property':
      case 'wild':
        return <PropertyCard card={card} size={size} />;
      case 'cash':
        return <CashCard card={card} size={size} />;
      case 'action':
        return <ActionCard card={card} size={size} />;
      case 'rent':
        return <RentCard card={card} size={size} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        sizeClasses[size],
        'rounded-lg shadow-md cursor-pointer transition-all duration-200',
        'border-2 flex flex-col overflow-hidden',
        isSelectable && 'hover:shadow-xl hover:-translate-y-1',
        isSelected && 'ring-2 ring-blue-500 ring-offset-2 scale-105',
        'bg-white'
      )}
      onClick={onClick}
    >
      {renderCardContent()}
    </div>
  );
}

function PropertyCard({ card, size }: { card: CardType; size: string }) {
  const color = card.color || 'brown';
  const isWildcard = card.isDualColor || card.colors;
  const colors = card.colors || [color];

  return (
    <>
      {/* Header with color */}
      <div className={cn(
        'w-full px-1 py-0.5 flex items-center justify-between',
        getColorClass(color),
        color === 'yellow' || color === 'lightblue' ? 'text-black' : 'text-white'
      )}>
        <span className="font-bold truncate">{size === 'sm' ? '' : getColorDisplayName(color)}</span>
        <span className="text-lg">{colorIcons[color]}</span>
      </div>

      {/* Card body */}
      <div className="flex-1 flex flex-col items-center justify-center p-1 bg-white">
        {/* Property name */}
        <div className="text-center font-bold text-gray-800 leading-tight mb-1">
          {card.name}
        </div>

        {/* Wildcard indicator */}
        {isWildcard && colors.length === 2 && (
          <div className="flex gap-0.5 mt-1">
            <div className={cn('w-4 h-4 rounded-full', getColorClass(colors[0]))} />
            <div className={cn('w-4 h-4 rounded-full', getColorClass(colors[1]))} />
          </div>
        )}

        {/* Property icon */}
        <div className="text-2xl mt-1">{colorIcons[color]}</div>
      </div>

      {/* Footer with value */}
      <div className="w-full bg-gray-100 px-1 py-0.5 flex items-center justify-between border-t">
        <span className="font-bold text-gray-700">${card.value}M</span>
        {card.isDualColor && <span className="text-[8px] text-gray-500">WILD</span>}
      </div>
    </>
  );
}

function CashCard({ card, size }: { card: CardType; size: string }) {
  const value = card.value;
  let bgColor = 'bg-yellow-100';
  let borderColor = 'border-yellow-300';
  
  if (value >= 10) {
    bgColor = 'bg-purple-100';
    borderColor = 'border-purple-300';
  } else if (value >= 5) {
    bgColor = 'bg-green-100';
    borderColor = 'border-green-300';
  } else if (value >= 3) {
    bgColor = 'bg-blue-100';
    borderColor = 'border-blue-300';
  } else if (value >= 2) {
    bgColor = 'bg-orange-100';
    borderColor = 'border-orange-300';
  }

  return (
    <>
      <div className={cn('w-full h-full flex flex-col', bgColor)}>
        {/* Top value */}
        <div className="px-1 py-0.5 flex justify-between items-center">
          <span className="font-bold text-gray-700">${value}M</span>
        </div>

        {/* Center - Large value */}
        <div className="flex-1 flex items-center justify-center">
          <div className={cn(
            'rounded-full flex items-center justify-center font-bold text-gray-800',
            size === 'sm' ? 'w-10 h-10 text-sm' : size === 'md' ? 'w-14 h-14 text-lg' : 'w-20 h-20 text-2xl',
            'bg-white border-2',
            borderColor
          )}>
            ${value}M
          </div>
        </div>

        {/* Bottom value */}
        <div className="px-1 py-0.5 flex justify-end">
          <span className="font-bold text-gray-700">${value}M</span>
        </div>
      </div>
    </>
  );
}

function ActionCard({ card, size }: { card: CardType; size: string }) {
  const icon = actionIcons[card.actionType || ''] || '🎯';
  
  // Different colors for different action types
  const actionColors: Record<string, { bg: string; border: string; header: string }> = {
    dealbreaker: { bg: 'bg-red-50', border: 'border-red-300', header: 'bg-red-500' },
    debtcollector: { bg: 'bg-green-50', border: 'border-green-300', header: 'bg-green-500' },
    forceddeal: { bg: 'bg-blue-50', border: 'border-blue-300', header: 'bg-blue-500' },
    slydeal: { bg: 'bg-purple-50', border: 'border-purple-300', header: 'bg-purple-500' },
    birthday: { bg: 'bg-pink-50', border: 'border-pink-300', header: 'bg-pink-500' },
    passgo: { bg: 'bg-yellow-50', border: 'border-yellow-300', header: 'bg-yellow-500' },
    house: { bg: 'bg-amber-50', border: 'border-amber-300', header: 'bg-amber-500' },
    hotel: { bg: 'bg-indigo-50', border: 'border-indigo-300', header: 'bg-indigo-500' },
    sayno: { bg: 'bg-rose-50', border: 'border-rose-300', header: 'bg-rose-500' },
  };

  const colors = actionColors[card.actionType || ''] || { bg: 'bg-gray-50', border: 'border-gray-300', header: 'bg-gray-500' };

  return (
    <>
      {/* Header */}
      <div className={cn('w-full px-1 py-0.5 text-white font-bold text-center', colors.header)}>
        ACTION
      </div>

      {/* Body */}
      <div className={cn('flex-1 flex flex-col items-center justify-center p-1', colors.bg)}>
        {/* Large icon */}
        <div className={cn(
          'mb-1',
          size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-3xl' : 'text-4xl'
        )}>
          {icon}
        </div>

        {/* Action name */}
        <div className="text-center font-bold text-gray-800 leading-tight text-[9px]">
          {card.name}
        </div>

        {/* Description */}
        {size !== 'sm' && (
          <div className="text-center text-[7px] text-gray-600 mt-1 leading-tight px-0.5">
            {card.description}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full bg-gray-100 px-1 py-0.5 flex items-center justify-between border-t">
        <span className="font-bold text-gray-700">${card.value}M</span>
        <span className="text-[8px] text-gray-500">ACTION</span>
      </div>
    </>
  );
}

function RentCard({ card, size }: { card: CardType; size: string }) {
  const icon = actionIcons.rent;
  const rentColors = card.rentColors || ['brown', 'lightblue'];

  return (
    <>
      {/* Header */}
      <div className="w-full px-1 py-0.5 bg-gradient-to-r from-gray-700 to-gray-900 text-white font-bold text-center">
        RENT
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center p-1 bg-gray-50">
        {/* Large icon */}
        <div className={cn(
          'mb-1',
          size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-3xl' : 'text-4xl'
        )}>
          {icon}
        </div>

        {/* Color indicators */}
        <div className="flex gap-1 mb-1">
          {rentColors.map((color, idx) => (
            <div key={idx} className={cn('w-5 h-5 rounded border-2 border-white shadow-sm', getColorClass(color))} />
          ))}
        </div>

        {/* Description */}
        {size !== 'sm' && (
          <div className="text-center text-[7px] text-gray-600 leading-tight px-0.5">
            {card.description}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full bg-gray-100 px-1 py-0.5 flex items-center justify-between border-t">
        <span className="font-bold text-gray-700">${card.value}M</span>
        <span className="text-[8px] text-gray-500">RENT</span>
      </div>
    </>
  );
}

export default CardComponent;
