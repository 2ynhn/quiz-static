import { useId } from 'react';
import { shade } from '../theme/themes.js';

// 카테고리별 배경 패턴 — 인라인 SVG 타일. 카드/칩 위에 absolute로 깔린다.
const TILES = {
  grid: {
    size: 18,
    render: (tone) => <path d="M0 9h18M9 0v18" stroke={tone} strokeWidth="1" fill="none" />,
  },
  wave: {
    size: 20,
    render: (tone) => <path d="M0 10q5 -8 10 0t10 0" stroke={tone} strokeWidth="1.2" fill="none" />,
  },
  dot: {
    size: 12,
    render: (tone) => <circle cx="6" cy="6" r="1.4" fill={tone} />,
  },
  square: {
    size: 12,
    render: (tone) => <rect x="4.5" y="4.5" width="3" height="3" fill={tone} />,
  },
  diagonal: {
    size: 12,
    render: (tone) => <path d="M0 12L12 0" stroke={tone} strokeWidth="1" fill="none" />,
  },
};

export default function PatternBg({ pattern, color, opacity = 0.18, toneLightness = 78 }) {
  // useId로 카테고리/인스턴스마다 <pattern> id 충돌 방지
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const tile = TILES[pattern] || TILES.dot;
  const patternId = `pat-${pattern}-${reactId}`;
  const tone = shade(color, toneLightness);

  return (
    <svg className="pattern-bg" aria-hidden="true" style={{ opacity }}>
      <defs>
        <pattern id={patternId} width={tile.size} height={tile.size} patternUnits="userSpaceOnUse">
          {tile.render(tone)}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
