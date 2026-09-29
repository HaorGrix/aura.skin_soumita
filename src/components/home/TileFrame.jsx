/* =================================================================== *
 * skin.theory — category tile template
 * -------------------------------------------------------------------
 * The fixed design every home category tile shares: a blue arch with a
 * sunburst, a navy name bar and the name in white capitals. The admin only
 * uploads the "sticker" — a cut-out PNG (transparent background) of a
 * person or products — which sits inside the arch, bottom-aligned, scaled
 * to fit. Same 750 × 885 canvas as the original artwork, so tiles made
 * either way line up in the grid.
 * =================================================================== */
import { useId } from "react";

const W = 750;
const H = 885;
const ARCH = { left: 54, right: 697, top: 138, bottom: 700 };
const RADIUS = (ARCH.right - ARCH.left) / 2;
const CX = ARCH.left + RADIUS;
const RAYS = 24; // alternating wedges across the half circle
const DARK = "#7a96b0";
const LIGHT = "#a0b4c7";
const BAR = "#1b2a41";

const archPath =
  `M${ARCH.left},${ARCH.top + RADIUS} A${RADIUS},${RADIUS} 0 0 1 ${ARCH.right},${ARCH.top + RADIUS} ` +
  `L${ARCH.right},${ARCH.bottom} L${ARCH.left},${ARCH.bottom} Z`;

// Wedges fanning out from the bottom centre of the arch.
const rays = Array.from({ length: RAYS }, (_, i) => {
  const a0 = Math.PI + (i * Math.PI) / RAYS;
  const a1 = Math.PI + ((i + 1) * Math.PI) / RAYS;
  const r = 900;
  const p = (a) => `${(CX + r * Math.cos(a)).toFixed(1)},${(ARCH.bottom + r * Math.sin(a)).toFixed(1)}`;
  return { d: `M${CX},${ARCH.bottom} L${p(a0)} L${p(a1)} Z`, fill: i % 2 ? LIGHT : DARK };
});

export default function TileFrame({ label, sticker }) {
  const clipId = useId();
  const name = String(label ?? "").trim().toUpperCase();
  // Shrink long names so they always fit the bar in one line.
  const fontSize = Math.min(68, Math.floor(640 / Math.max(1, name.length * 0.58)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label={label}>
      <defs>
        <clipPath id={clipId}>
          <path d={archPath} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width={W} height={H} fill={LIGHT} />
        {rays.map((ray, i) => <path key={i} d={ray.d} fill={ray.fill} />)}
      </g>
      {sticker && (
        <image
          href={sticker}
          x={ARCH.left + 20}
          y={ARCH.top + 20}
          width={ARCH.right - ARCH.left - 40}
          height={ARCH.bottom - ARCH.top - 20}
          preserveAspectRatio="xMidYMax meet"
        />
      )}
      <path d={`M0,${ARCH.bottom - 3} H${W} V${H - 60} Q${W},${H} ${W - 60},${H} H60 Q0,${H} 0,${H - 60} Z`} fill={BAR} />
      <text
        x={W / 2}
        y={(ARCH.bottom + H) / 2 + fontSize * 0.36}
        textAnchor="middle"
        fill="#ffffff"
        fontFamily="Oswald, 'Arial Narrow', Arial, sans-serif"
        fontWeight="600"
        fontSize={fontSize}
        letterSpacing="4"
      >
        {name}
      </text>
    </svg>
  );
}
