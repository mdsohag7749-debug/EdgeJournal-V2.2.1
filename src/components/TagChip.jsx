import { colorForTag, hexToRgba } from '../lib/tags';

// A colored tag chip. Uses the tag's curated library color when known,
// otherwise a stable auto-derived color. `onClick` makes it a tappable
// pill; `onRemove` adds a small remove affordance.
export default function TagChip({ name, color, library, onRemove, onClick, active, title }) {
  const c = color || colorForTag(name, library);
  const isButton = Boolean(onClick);
  const inner = (
    <>
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: c,
          flexShrink: 0,
        }}
      />
      {name}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(name);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: 0,
            marginLeft: 2,
            display: 'inline-flex',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </>
  );

  const Wrapper = isButton ? 'button' : 'span';
  return (
    <Wrapper
      type={isButton ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className="tag"
      style={{
        background: hexToRgba(c, active ? 0.3 : 0.16),
        color: c,
        borderColor: hexToRgba(c, active ? 0.6 : 0.34),
        cursor: onClick ? 'pointer' : 'default',
        gap: 5,
      }}
    >
      {inner}
    </Wrapper>
  );
}