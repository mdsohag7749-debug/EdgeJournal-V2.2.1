// Analytics folder / tree navigation (Sprint 9.6).
//
// Two related controls over the SAME seven groups:
//   - AnalyticsTree: the desktop left column (filesystem-style tree). Each
//     folder is a <button> with aria-current (active section), aria-expanded
//     (group content visibility) and a slow-drawing red indicator.
//   - AnalyticsSectionSelector: the tablet/mobile compact horizontal chip
//     strip labelled "Analytics Sections".
//
// Clicking never reloads the page and never fires AI — it only expands the
// group (if collapsed) and smooth-scrolls to it (behavior 'auto' under
// prefers-reduced-motion).

export function AnalyticsTree({ groups, activeKey, onSelect }) {
  return (
    <nav className="analytics-tree" aria-label="Analytics sections">
      <div className="analytics-tree-heading">
        <span>ANALYTICS</span>
        <span className="analytics-tree-count">{groups.length} SECTIONS</span>
      </div>
      <div className="analytics-tree-list">
        {groups.map((g, i) => {
          const active = activeKey === g.key;
          return (
            <button
              key={g.key}
              type="button"
              className={`analytics-section-link${active ? ' analytics-section-link-active' : ''}`}
              aria-current={active ? 'location' : undefined}
              onClick={() => onSelect(g.key)}
              style={{ '--i': i }}
            >
              <span className="analytics-section-link-index" aria-hidden>
                {g.index}
              </span>
              <span className="analytics-section-link-label">{g.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function AnalyticsSectionSelector({ groups, activeKey, onSelect }) {
  return (
    <nav className="analytics-selector" aria-label="Analytics sections">
      <span className="analytics-selector-caption">ANALYTICS SECTIONS</span>
      <div className="analytics-selector-list">
        {groups.map((g) => {
          const active = activeKey === g.key;
          return (
            <button
              key={g.key}
              type="button"
              className={`analytics-chip${active ? ' analytics-chip-active' : ''}`}
              aria-current={active ? 'location' : undefined}
              aria-controls={g.id}
              onClick={() => onSelect(g.key)}
            >
              <span className="analytics-chip-index" aria-hidden>
                {g.index}
              </span>
              {g.short}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
