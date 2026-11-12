import { useId } from "react";

type Cell = { x: number; y: number; width: number; height: number };

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMark(seedText: string) {
  const seed = hashString(seedText);
  const random = createRandom(seed);
  const between = (min: number, max: number) => min + random() * (max - min);

  const baseHue = between(0, 360);
  const step = between(12, 32) * (random() > 0.5 ? 1 : -1);
  const palette = Array.from({ length: 5 }, (_, index) => {
    const hue = (baseHue + step * index + 360) % 360;
    return `hsl(${hue} ${between(25, 55)}% ${between(42, 80)}%)`;
  });

  const cells: Cell[] = [{ x: 0, y: 0, width: 100, height: 100 }];
  const splits = Math.round(between(3, 6));
  for (let count = 0; count < splits; count++) {
    cells.sort((a, b) => b.width * b.height - a.width * a.height);
    const cell = cells.shift()!;
    const ratio = between(0.3, 0.7);
    if (cell.width >= cell.height) {
      const width = cell.width * ratio;
      cells.push({ ...cell, width }, { ...cell, x: cell.x + width, width: cell.width - width });
    } else {
      const height = cell.height * ratio;
      cells.push({ ...cell, height }, { ...cell, y: cell.y + height, height: cell.height - height });
    }
  }

  const offset = Math.floor(between(0, palette.length));
  return {
    seed: seed % 1000,
    grain: between(0.7, 1.1),
    blur: between(16, 22),
    warp: { frequency: between(0.012, 0.03), scale: between(44, 64) },
    cells: cells.map((cell, index) => ({
      ...cell,
      from: palette[(index + offset) % palette.length],
      to: palette[(index + offset + 1) % palette.length],
      angle: between(0, 360),
    })),
  };
}

// Chrome ignores feGaussianBlur edgeMode, so edge cells extend past the viewBox to keep the blur from fading at the borders.
function bleed({ x, y, width, height }: Cell, amount = 50) {
  const left = x <= 0 ? x - amount : x;
  const top = y <= 0 ? y - amount : y;
  const right = x + width >= 100 ? x + width + amount : x + width;
  const bottom = y + height >= 100 ? y + height + amount : y + height;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function InvoiceMark({ seed, className = "" }: { seed: string; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mark = generateMark(seed);

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className={className}>
      <defs>
        {mark.cells.map((cell, index) => (
          <linearGradient key={index} id={`${id}-cell-${index}`} gradientTransform={`rotate(${cell.angle} 0.5 0.5)`}>
            <stop offset="0" stopColor={cell.from} />
            <stop offset="1" stopColor={cell.to} />
          </linearGradient>
        ))}
        <filter id={`${id}-blend`} filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="200">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={mark.warp.frequency}
            numOctaves="2"
            seed={mark.seed}
            result="warp"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="warp"
            scale={mark.warp.scale}
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur stdDeviation={mark.blur} />
        </filter>
        <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={mark.grain}
            numOctaves="3"
            seed={mark.seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>
      <g filter={`url(#${id}-blend)`}>
        {mark.cells.map((cell, index) => (
          <rect key={index} {...bleed(cell)} fill={`url(#${id}-cell-${index})`} />
        ))}
      </g>
      <rect width="100" height="100" filter={`url(#${id}-grain)`} opacity="0.55" style={{ mixBlendMode: "overlay" }} />
    </svg>
  );
}
