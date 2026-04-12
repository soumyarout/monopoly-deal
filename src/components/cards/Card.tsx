import type { Card as CardType, PropertyColor } from '@/types/game';
import { PROPERTY_SET_RENT } from '@/types/game';
import { useCurrency } from '@/context/CurrencyContext';
import { cn } from '@/lib/utils';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showBack?: boolean;
}

/* ─── Color palettes ─── */
const PROP_COLOR: Record<PropertyColor, { banner: string; text: string }> = {
  brown:     { banner: '#6b2d0e', text: '#fff' },   // deep chocolate brown
  lightblue: { banner: '#0ea5e9', text: '#fff' },
  pink:      { banner: '#db2777', text: '#fff' },
  orange:    { banner: '#f97316', text: '#fff' },
  red:       { banner: '#dc2626', text: '#fff' },
  yellow:    { banner: '#eab308', text: '#111' },   // bright yellow, dark text
  green:     { banner: '#16a34a', text: '#fff' },
  blue:      { banner: '#1d4ed8', text: '#fff' },
  black:     { banner: '#1f2937', text: '#fff' },
  utility:   { banner: '#4d7c0f', text: '#fff' },
};

const CASH_PAL: Record<number, { bg: string }> = {
  1:  { bg: '#f59e0b' },
  2:  { bg: '#38bdf8' },
  3:  { bg: '#4ade80' },
  4:  { bg: '#f87171' },
  5:  { bg: '#c084fc' },
  10: { bg: '#f97316' },
};

const ACTION_BG: Record<string, string> = {
  dealbreaker:   '#7c3aed',
  debtcollector: '#059669',
  forceddeal:    '#1d4ed8',
  slydeal:       '#be185d',
  birthday:      '#f472b6',
  passgo:        '#f1f5f9',
  house:         '#38bdf8',
  hotel:         '#f97316',
  sayno:         '#dc2626',
  doublerent:    '#0891b2',
};

const ACTION_LABEL: Record<string, string> = {
  dealbreaker:   'DEAL BREAKER',
  debtcollector: 'DEBT COLLECTOR',
  forceddeal:    'FORCED DEAL',
  slydeal:       'SLY DEAL',
  birthday:      "IT'S MY BIRTHDAY",
  passgo:        'PASS GO',
  house:         'HOUSE',
  hotel:         'HOTEL',
  sayno:         'JUST SAY NO',
  doublerent:    'DOUBLE THE RENT',
};

const ACTION_ICON: Record<string, string> = {
  dealbreaker:   '💥',
  debtcollector: '💰',
  forceddeal:    '🔄',
  slydeal:       '🥷',
  birthday:      '🎂',
  passgo:        '→',
  house:         '🏠',
  hotel:         '🏨',
  sayno:         '✋',
  doublerent:    '×2',
};

const ALL_COLORS: PropertyColor[] = ['brown','lightblue','pink','orange','red','yellow','green','blue','black','utility'];

/* ─── Shared sub-components ─── */

/** Circular currency+value badge */
function MBadge({ value, sz }: { value: number; sz: 'sm' | 'md' | 'lg' }) {
  const cur = useCurrency();
  const dim = sz === 'sm' ? 13 : sz === 'lg' ? 22 : 17;
  const fs  = sz === 'sm' ? 5.5 : sz === 'lg' ? 8.5 : 7;
  return (
    <div style={{
      width: dim, height: dim, borderRadius: '50%',
      background: 'white', border: '1.5px solid #9ca3af',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: fs, color: '#111', flexShrink: 0, lineHeight: 1,
    }}>
      {cur}{value}
    </div>
  );
}

/** Mini stacked card icons for rent table */
function PropStack({ count, color, sz }: { count: number; color: string; sz: 'sm' | 'md' | 'lg' }) {
  const isSm = sz === 'sm';
  const w = isSm ? 8 : 11, h = isSm ? 11 : 15, gap = isSm ? 1.5 : 2;
  const svgW = w + gap * (count - 1);
  const svgH = h + gap * (count - 1);
  return (
    <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block', flexShrink: 0 }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = i * gap, y = (count - 1 - i) * gap;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx={1} fill={color} stroke="white" strokeWidth={0.8} />
            {/* mini colored header stripe */}
            <rect x={x} y={y} width={w} height={h * 0.3} rx={0.5} fill="rgba(0,0,0,0.28)" />
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Card variants ─── */

function PropertyCard({ card, sz }: { card: CardType; sz: 'sm' | 'md' | 'lg' }) {
  const cur    = useCurrency();
  const color  = (card.color || 'brown') as PropertyColor;
  const isWild = card.isDualColor || (!!card.colors && card.colors.length > 0);
  if (isWild) return <WildPropertyCard card={card} sz={sz} />;

  const pal     = PROP_COLOR[color];
  const rentArr = PROPERTY_SET_RENT[color];
  const isSm    = sz === 'sm';
  const isLg    = sz === 'lg';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white' }}>

      {/* ── Colored banner ── */}
      <div style={{
        background: pal.banner,
        minHeight: isSm ? 22 : isLg ? 38 : 28,
        display: 'flex', alignItems: 'center',
        padding: isSm ? '2px 3px' : '3px 5px', gap: isSm ? 2 : 3,
      }}>
        <MBadge value={card.value} sz={sz} />
        <div style={{
          color: pal.text, fontWeight: 900,
          fontSize: isSm ? 5.5 : isLg ? 9.5 : 7,
          lineHeight: 1.1, flex: 1, textAlign: 'center',
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: isSm ? 'nowrap' : 'normal',
          wordBreak: 'break-word', letterSpacing: '0.01em',
        }}>
          {card.name.toUpperCase()}
        </div>
      </div>

      {/* ── Rent table ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: isSm ? '2px 3px' : '2px 4px',
      }}>
        {/* Column headers */}
        {!isSm && (
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 4.5, color: '#9ca3af', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            paddingBottom: 1.5, borderBottom: '0.5px solid #e5e7eb',
            marginBottom: 1,
          }}>
            <span>PROPERTIES OWNED</span>
            <span>RENT</span>
          </div>
        )}

        {/* Rent rows */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
          {rentArr.map((rent, i) => {
            const isLast = i === rentArr.length - 1;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: isLast && !isSm ? '0.5px solid #e5e7eb' : undefined,
                paddingTop: isLast && !isSm ? 2 : 0,
              }}>
                <PropStack count={i + 1} color={pal.banner} sz={sz} />
                <div style={{ fontWeight: 900, fontSize: isSm ? 7.5 : isLg ? 12 : 9.5, color: '#111' }}>
                  {cur}{rent}
                </div>
              </div>
            );
          })}
        </div>

        {/* Complete set label */}
        {!isSm && (
          <div style={{
            fontSize: 5, color: pal.banner, fontWeight: 800,
            textAlign: 'center', letterSpacing: '0.04em', paddingBottom: 1.5,
          }}>
            COMPLETE SET
          </div>
        )}
      </div>
    </div>
  );
}

function WildPropertyCard({ card, sz }: { card: CardType; sz: 'sm' | 'md' | 'lg' }) {
  const colors       = card.colors || [card.color || 'brown'];
  const uniqueColors = [...new Set(colors)];
  // Single-color wildcard (e.g. ['black','black'] railroad-only) → treat as universal-style
  const isUniversal  = uniqueColors.length !== 2;
  const isSm         = sz === 'sm';
  const isLg         = sz === 'lg';

  /* Single-color or true universal wildcard — full rainbow fill, visually powerful */
  if (isUniversal) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: 'linear-gradient(160deg,#7c3aed 0%,#db2777 35%,#f97316 65%,#eab308 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Sheen overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 55%)',
          pointerEvents: 'none',
        }} />
        {/* Value badge top-left */}
        <div style={{ padding: isSm ? '2px 3px' : '3px 5px', position: 'relative', zIndex: 1 }}>
          <MBadge value={card.value} sz={sz} />
        </div>
        {/* Body */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: isSm ? 2 : 3, padding: isSm ? '2px' : '4px',
          position: 'relative', zIndex: 1,
        }}>
          {/* Star icon */}
          <div style={{ fontSize: isSm ? 14 : isLg ? 32 : 22, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
            ⭐
          </div>
          {/* Title */}
          <div style={{
            color: 'white', fontWeight: 900, textAlign: 'center',
            fontSize: isSm ? 5.5 : isLg ? 10 : 7.5,
            lineHeight: 1.2, letterSpacing: '0.02em',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}>
            WILD{'\n'}PROPERTY
          </div>
          {/* Colour dots */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', maxWidth: isSm ? 50 : 70 }}>
            {ALL_COLORS.map(c => (
              <div key={c} style={{
                width: isSm ? 7 : 9, height: isSm ? 7 : 9,
                borderRadius: '50%', background: PROP_COLOR[c].banner,
                border: '1.5px solid rgba(255,255,255,0.8)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }} />
            ))}
          </div>
          {!isSm && (
            <div style={{
              color: 'rgba(255,255,255,0.9)', fontWeight: 700,
              fontSize: 5.5, textAlign: 'center', letterSpacing: '0.06em',
              textShadow: '0 1px 2px rgba(0,0,0,0.4)',
            }}>
              ANY COLOUR
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Dual-color wildcard — top half + bottom half rotated */
  const c1   = uniqueColors[0] as PropertyColor;
  const c2   = uniqueColors[1] as PropertyColor;
  const pal1 = PROP_COLOR[c1];
  const pal2 = PROP_COLOR[c2];
  const halfStyle = (pal: typeof pal1): React.CSSProperties => ({
    flex: 1, background: pal.banner,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '3px 2px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top half */}
      <div style={halfStyle(pal1)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <MBadge value={card.value} sz={sz} />
          <div style={{ color: pal1.text, fontWeight: 900, fontSize: isSm ? 5.5 : isLg ? 8.5 : 7 }}>WILD</div>
        </div>
        <div style={{ color: pal1.text, fontWeight: 900, fontSize: isSm ? 14 : isLg ? 22 : 18, lineHeight: 1 }}>↑</div>
        {!isSm && (
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 5, fontWeight: 700, letterSpacing: '0.04em', marginTop: 1 }}>
            {c1.toUpperCase()}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 2, background: 'white', flexShrink: 0 }} />

      {/* Bottom half — rotated 180° so it reads from the other end */}
      <div style={{ ...halfStyle(pal2), transform: 'rotate(180deg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
          <MBadge value={card.value} sz={sz} />
          <div style={{ color: pal2.text, fontWeight: 900, fontSize: isSm ? 5.5 : isLg ? 8.5 : 7 }}>WILD</div>
        </div>
        <div style={{ color: pal2.text, fontWeight: 900, fontSize: isSm ? 14 : isLg ? 22 : 18, lineHeight: 1 }}>↑</div>
        {!isSm && (
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 5, fontWeight: 700, letterSpacing: '0.04em', marginTop: 1 }}>
            {c2.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function CashCard({ card, sz }: { card: CardType; sz: 'sm' | 'md' | 'lg' }) {
  const cur  = useCurrency();
  const v    = card.value;
  const bg   = (CASH_PAL[v] ?? CASH_PAL[1]).bg;
  const isSm = sz === 'sm';
  const isLg = sz === 'lg';

  return (
    <div style={{ height: '100%', background: bg, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {/* Watermark number */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isSm ? 56 : isLg ? 104 : 76,
        fontWeight: 900, color: 'rgba(255,255,255,0.15)',
        letterSpacing: '-0.05em', userSelect: 'none', pointerEvents: 'none',
      }}>{v}</div>

      {/* Top badges */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        padding: isSm ? '2px 3px' : '3px 5px',
        position: 'relative', zIndex: 1,
      }}>
        <MBadge value={v} sz={sz} />
        <MBadge value={v} sz={sz} />
      </div>

      {/* Center denomination */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          fontWeight: 900, color: 'white',
          fontSize: isSm ? 9 : isLg ? 18 : 13,
          lineHeight: 1, letterSpacing: '-0.02em',
        }}>{cur}</div>
        <div style={{
          fontWeight: 900, color: 'white',
          fontSize: isSm ? 22 : isLg ? 52 : 36,
          lineHeight: 1, letterSpacing: '-0.03em',
        }}>{v}</div>
      </div>

      {/* Bottom: MONOPOLY + badge */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: isSm ? '2px 3px' : '3px 5px',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          fontWeight: 900, fontSize: isSm ? 4.5 : isLg ? 7 : 6,
          color: 'white', letterSpacing: '0.12em', opacity: 0.9,
        }}>MONOPOLY</div>
        <MBadge value={v} sz={sz} />
      </div>
    </div>
  );
}

function ActionCard({ card, sz }: { card: CardType; sz: 'sm' | 'md' | 'lg' }) {
  const cur       = useCurrency();
  const key       = card.actionType || '';
  const bg        = ACTION_BG[key] ?? '#6b7280';
  const label     = ACTION_LABEL[key] ?? card.name.toUpperCase();
  const icon      = ACTION_ICON[key] ?? '🎯';
  const isLightBg = key === 'passgo';
  const textColor = isLightBg ? '#111827' : 'white';
  const isSm      = sz === 'sm';
  const isLg      = sz === 'lg';

  return (
    <div style={{ height: '100%', background: bg, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3,
        padding: isSm ? '2px 3px' : '3px 5px',
      }}>
        <MBadge value={card.value} sz={sz} />
        <div style={{
          color: textColor, fontWeight: 700, opacity: 0.85,
          fontSize: isSm ? 5 : isLg ? 7.5 : 6.5, letterSpacing: '0.1em',
        }}>ACTION</div>
      </div>

      {/* Body: circle icon + name + description */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: isSm ? '1px 2px 2px' : '2px 4px 4px', gap: isSm ? 2 : 3,
      }}>
        {/* Icon circle */}
        <div style={{
          width:  isSm ? 26 : isLg ? 54 : 38,
          height: isSm ? 26 : isLg ? 54 : 38,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.22)',
          border: '2px solid rgba(255,255,255,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: isSm ? 13 : isLg ? 28 : 20,
        }}>
          {icon}
        </div>

        {/* Card name */}
        <div style={{
          color: textColor, fontWeight: 900, textAlign: 'center',
          fontSize: isSm ? 5.5 : isLg ? 10 : 7.5,
          lineHeight: 1.15, letterSpacing: '0.02em',
        }}>{label}</div>

        {/* Description */}
        {!isSm && card.description && (
          <div style={{
            color: textColor, opacity: 0.82, textAlign: 'center',
            fontSize: isLg ? 7.5 : 5.5, lineHeight: 1.25, padding: '0 1px',
          }}>{card.description?.replace(/\$/g, cur)}</div>
        )}
      </div>
    </div>
  );
}

function RentCard({ card, sz }: { card: CardType; sz: 'sm' | 'md' | 'lg' }) {
  const isWild = !card.rentColors || card.rentColors.length === 0;
  const isSm   = sz === 'sm';
  const isLg   = sz === 'lg';

  /* Wild rent — purple gradient, all colour dots */
  if (isWild) {
    return (
      <div style={{
        height: '100%',
        background: 'linear-gradient(135deg,#6d28d9,#4c1d95)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: isSm ? '2px 3px' : '3px 5px' }}>
          <MBadge value={card.value} sz={sz} />
          <div style={{ color: 'white', fontWeight: 700, fontSize: isSm ? 5 : 6.5, letterSpacing: '0.1em', opacity: 0.85 }}>
            RENT
          </div>
        </div>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 3, padding: '2px',
        }}>
          <div style={{ color: 'white', fontWeight: 900, fontSize: isSm ? 7 : isLg ? 12 : 9.5, letterSpacing: '0.05em' }}>
            WILD RENT
          </div>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center',
            maxWidth: isSm ? 50 : 74,
          }}>
            {ALL_COLORS.map(c => (
              <div key={c} style={{
                width: isSm ? 7 : 9, height: isSm ? 7 : 9,
                borderRadius: '50%', background: PROP_COLOR[c].banner,
                border: '1px solid rgba(255,255,255,0.45)',
              }} />
            ))}
          </div>
          {!isSm && (
            <div style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 700, fontSize: 6, letterSpacing: '0.06em' }}>
              ANY COLOR
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Standard dual-color rent card */
  const c1   = card.rentColors![0] as PropertyColor;
  const c2   = card.rentColors![1] as PropertyColor;
  const pal1 = PROP_COLOR[c1];
  const pal2 = PROP_COLOR[c2];

  const halfContent = (pal: typeof pal1, colorKey: PropertyColor) => (
    <div style={{
      flex: 1, background: pal.banner,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '3px 2px', gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <MBadge value={card.value} sz={sz} />
        <div style={{ color: pal.text, fontWeight: 900, fontSize: isSm ? 5 : isLg ? 8 : 6.5, letterSpacing: '0.08em' }}>
          RENT
        </div>
      </div>
      {!isSm && (
        <div style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 5, letterSpacing: '0.06em' }}>
          {colorKey.toUpperCase()}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {halfContent(pal1, c1)}
      <div style={{ height: 2, background: 'white', flexShrink: 0 }} />
      <div style={{ flex: 1, transform: 'rotate(180deg)', display: 'flex', flexDirection: 'column' }}>
        {halfContent(pal2, c2)}
      </div>
    </div>
  );
}

/* ─── Main export ─── */
export function CardComponent({
  card,
  onClick,
  isSelectable = false,
  isSelected = false,
  size = 'md',
  showBack = false,
}: CardProps) {
  const sizeClass = size === 'sm' ? 'w-16 h-24' : size === 'lg' ? 'w-32 h-48' : 'w-24 h-36';

  if (showBack) {
    return (
      <div
        className={cn(sizeClass, 'rounded-lg shadow-lg cursor-pointer transition-transform hover:scale-105 flex items-center justify-center border-2 border-yellow-400/30')}
        style={{ background: 'linear-gradient(135deg,#166534,#15803d)' }}
        onClick={onClick}
      >
        <div style={{ fontWeight: 900, fontSize: size === 'sm' ? 18 : 26, color: '#fbbf24' }}>M</div>
      </div>
    );
  }

  const renderContent = () => {
    switch (card.type) {
      case 'property':
      case 'wild':
        return <PropertyCard card={card} sz={size} />;
      case 'cash':
        return <CashCard card={card} sz={size} />;
      case 'action':
        return <ActionCard card={card} sz={size} />;
      case 'rent':
        return <RentCard card={card} sz={size} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        sizeClass,
        'rounded-lg shadow-md cursor-pointer transition-all duration-200 overflow-hidden border-2',
        isSelectable && 'hover:shadow-xl hover:-translate-y-1.5',
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-400 ring-offset-1 scale-105 shadow-blue-300/40 shadow-lg'
          : 'border-gray-200',
      )}
      style={{ flexShrink: 0 }}
      onClick={onClick}
    >
      {renderContent()}
    </div>
  );
}

export default CardComponent;
