import React, { useRef, useState } from 'react';

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface HoverRevealCardProps {
  /** Numeric label shown on the panel, e.g. "01" */
  cardNumber: string;
  title: string;
  subtitle: string;
  panelGradient: string;
  iridGradient: string;
  notchPath?: string;
  objectAsset: React.ReactNode;
  accentColor: string;
  onClick?: () => void;
  className?: string;
}

/* Default notch: clips the full rectangle so the panel fills the area */
const DEFAULT_NOTCH = 'M0,0 H280 V120 H0 Z';

export function HoverRevealCard({
  cardNumber,
  title,
  subtitle,
  panelGradient,
  iridGradient,
  notchPath = DEFAULT_NOTCH,
  objectAsset,
  accentColor,
  onClick,
  className = '',
}: HoverRevealCardProps) {
  const [hovered, setHovered] = useState(false);
  const everHovered = useRef(false);
  if (hovered) everHovered.current = true;

  const maskId = 'hrc-mask-' + cardNumber;

  let objClass = 'opacity-0 pointer-events-none';
  if (hovered) objClass = 'hrc-rise';
  else if (everHovered.current) objClass = 'hrc-drop';

  return (
    <div
      className={'group relative cursor-pointer select-none ' + className}
      style={{ paddingTop: '3.5rem', filter: hovered ? 'drop-shadow(0 0 22px ' + accentColor + '66)' : 'none', transition: 'filter 0.35s ease' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={'absolute left-1/2 ' + objClass} style={{ top: '-2.4rem', transform: 'translateX(-50%)', width: 72, height: 72, zIndex: 20, willChange: 'transform, opacity' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,' + accentColor + '55,transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          {objectAsset}
        </div>
      </div>

      <div className="relative rounded-2xl border overflow-hidden" style={{ borderColor: hovered ? accentColor + '80' : '#1e2c40', background: 'linear-gradient(160deg,#0f172a 0%,#0b1220 100%)', transition: 'border-color 0.35s ease' }}>
        <div className="relative" style={{ height: 110, overflow: 'visible' }}>
          <svg viewBox="0 0 280 120" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}>
            <defs>
              <clipPath id={maskId}>
                <path d={notchPath} />
              </clipPath>
            </defs>
            <foreignObject x="0" y="0" width="280" height="120" clipPath={'url(#' + maskId + ')'}>
              <div style={{ width: '100%', height: '100%', background: hovered ? iridGradient : panelGradient, backgroundSize: hovered ? '400% 400%' : '100% 100%', transition: 'background 0.4s ease' }} className={hovered ? 'hrc-panel-irid' : ''} />
            </foreignObject>
            {hovered && (
              <foreignObject x="0" y="0" width="280" height="120" clipPath={'url(#' + maskId + ')'} style={{ mixBlendMode: 'screen', opacity: 0.35 }}>
                <div className="hrc-sweep" style={{ width: '100%', height: '100%', background: 'linear-gradient(105deg,transparent 20%,rgba(255,255,255,0.7) 50%,transparent 80%)' }} />
              </foreignObject>
            )}
          </svg>

          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 1rem 0.9rem 1.1rem', pointerEvents: 'none' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '2.1rem', lineHeight: 1, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.04em', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>{cardNumber}</span>
            <span style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.75)', fontWeight: 700, transition: 'transform 0.25s ease', transform: hovered ? 'translate(3px,-3px)' : 'none' }}>↗</span>
          </div>
        </div>

        <div className="px-5 pb-5 pt-4">
          <h3 style={{ color: hovered ? '#fff' : '#e2e8f0', fontWeight: 700, fontSize: '0.95rem', transition: 'color 0.25s' }}>{title}</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: '0.4rem', lineHeight: 1.55 }}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
