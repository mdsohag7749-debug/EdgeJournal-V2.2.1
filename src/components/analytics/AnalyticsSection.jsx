// Analytics folder section (Sprint 9.6). Wraps one of the seven conceptual
// groups as a folder row: index chip, folder icon, heading + technical
// eyebrow, and an accessible collapse/expand toggle (aria-expanded /
// aria-controls). The fold animates height/opacity via a CSS grid-template
// rows trick so no JS measurement loop is needed, and is fully inert under
// prefers-reduced-motion.

export default function AnalyticsSection({ group, registerSection, children }) {
  return (
    <section
      id={group.id}
      data-section-key={group.key}
      ref={registerSection(group.key)}
      className="analytics-group"
      aria-labelledby={`${group.id}-heading`}
    >
      <div className="analytics-group-headrow">
        <span className="analytics-group-index" aria-hidden>
          {group.index}
        </span>
        <div className="analytics-group-head">
          <h3 id={`${group.id}-heading`} className="analytics-group-title">
            {group.title}
          </h3>
          <span className="analytics-group-eyebrow">{group.eyebrow}</span>
        </div>
      </div>
      <div className="analytics-group-body">{children}</div>
    </section>
  );
}
