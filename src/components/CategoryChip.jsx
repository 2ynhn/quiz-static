import PatternBg from './PatternBg.jsx';
import { shade } from '../theme/themes.js';

// 테마가 입혀진 카테고리 칩 — onClick이 없으면 표시 전용(div)으로 렌더
export default function CategoryChip({ name, theme, label, selected, small, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`cat-chip${selected ? ' cat-chip--selected' : ''}${small ? ' cat-chip--small' : ''}`}
      style={{
        background: shade(theme.color, 14),
        borderColor: theme.color,
        color: shade(theme.color, 80),
      }}
    >
      <PatternBg pattern={theme.pattern} color={theme.color} opacity={0.18} />
      <span className="cat-chip__emoji">{theme.emoji}</span>
      <span className="cat-chip__label">{label || name}</span>
    </Tag>
  );
}
