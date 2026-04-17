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
  pink:      { banner: '#f72585', text: '#fff' },  // vivid hot pink — distinct from red
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
  const cur          = useCurrency();
  const colors       = card.colors || [card.color || 'brown'];
  const uniqueColors = [...new Set(colors)];
  // Single-color wildcard (e.g. ['black','black'] railroad-only) → treat as universal-style
  const isUniversal  = uniqueColors.length !== 2;
  const isSm         = sz === 'sm';
  const isLg         = sz === 'lg';

  /* Universal wildcard — full rainbow fill, bold and distinctive */
  if (isUniversal) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: 'linear-gradient(160deg,#7c3aed 0%,#db2777 35%,#f97316 65%,#eab308 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ padding: isSm ? '2px 3px' : '3px 5px', position: 'relative', zIndex: 1 }}>
          <MBadge value={card.value} sz={sz} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: isSm ? 2 : 3, padding: isSm ? '2px' : '4px', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: isSm ? 14 : isLg ? 32 : 22, lineHeight: 1, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>⭐</div>
          <div style={{ color: 'white', fontWeight: 900, textAlign: 'center', fontSize: isSm ? 5.5 : isLg ? 10 : 7.5, lineHeight: 1.2, letterSpacing: '0.02em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            WILD{'\n'}PROPERTY
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', maxWidth: isSm ? 50 : 70 }}>
            {ALL_COLORS.map(c => (
              <div key={c} style={{ width: isSm ? 7 : 9, height: isSm ? 7 : 9, borderRadius: '50%', background: PROP_COLOR[c].banner, border: '1.5px solid rgba(255,255,255,0.8)', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
            ))}
          </div>
          {!isSm && <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 5.5, textAlign: 'center', letterSpacing: '0.06em', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>ANY COLOUR</div>}
        </div>
      </div>
    );
  }

  /* Dual-color PROPERTY wildcard — two solid halves, rent tables, clearly a property card */
  const c1   = uniqueColors[0] as PropertyColor;
  const c2   = uniqueColors[1] as PropertyColor;
  const pal1 = PROP_COLOR[c1];
  const pal2 = PROP_COLOR[c2];
  const rent1 = PROPERTY_SET_RENT[c1];
  const rent2 = PROPERTY_SET_RENT[c2];

  const half = (pal: typeof pal1): React.CSSProperties => ({
    flex: 1, background: pal.banner,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: isSm ? '2px 3px' : '3px 4px', gap: isSm ? 1 : 2,
  });

  const RentPips = ({ rentArr, textColor }: { rentArr: number[]; textColor: string }) => (
    <div style={{ display: 'flex', gap: isSm ? 2 : 3, alignItems: 'center' }}>
      {rentArr.map((r, i) => (
        <div key={i} style={{ color: textColor, fontSize: isSm ? 5 : 6, fontWeight: 800, opacity: 0.92 }}>{cur}{r}</div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top half — color 1 */}
      <div style={half(pal1)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <MBadge value={card.value} sz={sz} />
          <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontSize: isSm ? 4.5 : 5.5, letterSpacing: '0.06em' }}>PROPERTY</div>
        </div>
        <div style={{ color: pal1.text, fontWeight: 900, fontSize: isSm ? 6 : isLg ? 10 : 7.5, textAlign: 'center', lineHeight: 1.1, textShadow: '0 1px 2px rgba(0,0,0,0.3)', letterSpacing: '0.01em' }}>
          WILD CARD
        </div>
        {!isSm && (
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 4.5, fontWeight: 700, letterSpacing: '0.04em' }}>
            USE AS {c1.toUpperCase()}
          </div>
        )}
        <RentPips rentArr={rent1} textColor={pal1.text} />
      </div>

      {/* Divider */}
      <div style={{ height: 2, background: 'white', flexShrink: 0 }} />

      {/* Bottom half — color 2, rotated so it reads from the other end */}
      <div style={{ ...half(pal2), transform: 'rotate(180deg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <MBadge value={card.value} sz={sz} />
          <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontSize: isSm ? 4.5 : 5.5, letterSpacing: '0.06em' }}>PROPERTY</div>
        </div>
        <div style={{ color: pal2.text, fontWeight: 900, fontSize: isSm ? 6 : isLg ? 10 : 7.5, textAlign: 'center', lineHeight: 1.1, textShadow: '0 1px 2px rgba(0,0,0,0.3)', letterSpacing: '0.01em' }}>
          WILD CARD
        </div>
        {!isSm && (
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 4.5, fontWeight: 700, letterSpacing: '0.04em' }}>
            USE AS {c2.toUpperCase()}
          </div>
        )}
        <RentPips rentArr={rent2} textColor={pal2.text} />
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

/** Pre-computed pie arc paths for the 10-color wild rent wheel */
const PIE_PATHS = ALL_COLORS.map((_, i) => {
  const n = ALL_COLORS.length;
  const a1 = -Math.PI / 2 + (2 * Math.PI * i) / n;
  const a2 = -Math.PI / 2 + (2 * Math.PI * (i + 1)) / n;
  const x1 = (50 + 45 * Math.cos(a1)).toFixed(2);
  const y1 = (50 + 45 * Math.sin(a1)).toFixed(2);
  const x2 = (50 + 45 * Math.cos(a2)).toFixed(2);
  const y2 = (50 + 45 * Math.sin(a2)).toFixed(2);
  return `M 50 50 L ${x1} ${y1} A 45 45 0 0 1 ${x2} ${y2} Z`;
});

function RentCard({ card, sz }: { card: CardType; sz: 'sm' | 'md' | 'lg' }) {
  const isWild = !card.rentColors || card.rentColors.length === 0;
  const isSm   = sz === 'sm';
  const isLg   = sz === 'lg';

  // Shared ACTION CARD parchment style
  const BG      = '#f2ece0';          // tan parchment
  const BORDER  = '#c8b99a';
  const HEADER_TEXT = '#6b5230';
  const circD   = isSm ? 30 : isLg ? 60 : 42; // circle diameter in px

  /* ── Wild rent — parchment bg + 10-color pie wheel ── */
  if (isWild) {
    return (
      <div style={{ height: '100%', background: BG, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: isSm ? '2px 3px' : '3px 5px', borderBottom: `1px solid ${BORDER}` }}>
          <MBadge value={card.value} sz={sz} />
          <div style={{ fontSize: isSm ? 4.5 : 5.5, fontWeight: 800, color: HEADER_TEXT, letterSpacing: '0.08em', flex: 1, textAlign: 'center' }}>
            ACTION CARD
          </div>
        </div>
        {/* Body */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: isSm ? 2 : 3, padding: '3px' }}>
          {/* 10-slice pie */}
          <svg width={circD} height={circD} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
            {ALL_COLORS.map((c, i) => (
              <path key={c} d={PIE_PATHS[i]} fill={PROP_COLOR[c].banner} stroke="white" strokeWidth="1" />
            ))}
            {/* White center */}
            <circle cx="50" cy="50" r="27" fill="white" />
            <text x="50" y="55" textAnchor="middle" fontWeight="900" fontSize="17" fill="#1a1a1a" fontFamily="system-ui,sans-serif">RENT</text>
          </svg>
          <div style={{ color: HEADER_TEXT, fontWeight: 900, fontSize: isSm ? 6 : isLg ? 11 : 8, letterSpacing: '0.04em' }}>
            WILD RENT
          </div>
          {!isSm && (
            <div style={{ color: '#8a7050', fontSize: 5, textAlign: 'center', lineHeight: 1.3, padding: '0 2px' }}>
              Force one player to pay rent for any color you own
            </div>
          )}
        </div>
        {!isSm && (
          <div style={{ padding: '2px 3px', display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${BORDER}` }}>
            <div style={{ transform: 'rotate(180deg)' }}><MBadge value={card.value} sz={sz} /></div>
          </div>
        )}
      </div>
    );
  }

  /* ── Dual-color rent — parchment bg + split-circle badge ── */
  const c1   = card.rentColors![0] as PropertyColor;
  const c2   = card.rentColors![1] as PropertyColor;
  const pal1 = PROP_COLOR[c1];
  const pal2 = PROP_COLOR[c2];

  // Split circle: left semicircle = c1, right = c2, white centre with RENT
  const SplitCircle = () => (
    <svg width={circD} height={circD} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      {/* Left half */}
      <path d="M 50 5 A 45 45 0 0 0 50 95 Z" fill={pal1.banner} />
      {/* Right half */}
      <path d="M 50 5 A 45 45 0 0 1 50 95 Z" fill={pal2.banner} />
      {/* Divider line */}
      <line x1="50" y1="5" x2="50" y2="95" stroke="white" strokeWidth="2" />
      {/* White centre circle */}
      <circle cx="50" cy="50" r="27" fill="white" />
      <text x="50" y="55" textAnchor="middle" fontWeight="900" fontSize="17" fill="#1a1a1a" fontFamily="system-ui,sans-serif">RENT</text>
    </svg>
  );

  return (
    <div style={{ height: '100%', background: BG, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: isSm ? '2px 3px' : '3px 5px', borderBottom: `1px solid ${BORDER}` }}>
        <MBadge value={card.value} sz={sz} />
        <div style={{ fontSize: isSm ? 4.5 : 5.5, fontWeight: 800, color: HEADER_TEXT, letterSpacing: '0.08em', flex: 1, textAlign: 'center' }}>
          ACTION CARD
        </div>
      </div>
      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: isSm ? 1 : 3, padding: '3px' }}>
        <SplitCircle />
        {/* Color labels */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isSm ? 2 : 3 }}>
          <div style={{ background: pal1.banner, color: pal1.text, fontSize: isSm ? 4 : 5, fontWeight: 800, padding: isSm ? '1px 2px' : '1px 4px', borderRadius: 3, letterSpacing: '0.04em' }}>
            {c1.toUpperCase()}
          </div>
          <div style={{ color: '#9a8060', fontSize: isSm ? 5 : 7, fontWeight: 700 }}>/</div>
          <div style={{ background: pal2.banner, color: pal2.text, fontSize: isSm ? 4 : 5, fontWeight: 800, padding: isSm ? '1px 2px' : '1px 4px', borderRadius: 3, letterSpacing: '0.04em' }}>
            {c2.toUpperCase()}
          </div>
        </div>
        {!isSm && (
          <div style={{ color: '#8a7050', fontSize: 5, textAlign: 'center', lineHeight: 1.3, padding: '0 2px' }}>
            All players pay rent for one of these colors
          </div>
        )}
      </div>
      {!isSm && (
        <div style={{ padding: '2px 3px', display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ transform: 'rotate(180deg)' }}><MBadge value={card.value} sz={sz} /></div>
        </div>
      )}
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
