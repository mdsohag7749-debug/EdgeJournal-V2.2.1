// Analytics folder section (Sprint 9.6). Wraps one of the seven conceptual
// groups as a folder row: index chip, folder icon, heading + technical
// eyebrow, and an accessible collapse/expand toggle (aria-expanded /
// aria-controls). The fold animates height/opacity via a CSS grid-template
// rows trick so no JS measurement loop is needed, and is fully inert under
// prefers-reduced-motion.

import { ChevronDown, Folder, FolderOpen } from 'lucide-react';

export default function AnalyticsSection({ group, expanded, onToggle, registerSection, order, children }) {
  return (
    <section
      id={group.id}
      data-section-key={group.key}
      ref={registerSection(group.key)}
      className="analytics-group"
      aria-labelledby={`${group.id}-heading`}
      style={{ '--order': order }}
    >
      <div className="analytics-group-headrow">
        <span className="analytics-group-index" aria-hidden>
          {group.index}
        </span>
        <span className="analytics-group-folder" aria-hidden>
          {expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
        </span>
        <div className="analytics-group-head">
          <h3 id={`${group.id}-heading`} className="analytics-group-title">
            {group.title}
          </h3>
          <span className="analytics-group-eyebrow">{group.eyebrow}</span>
        </div>
        <button
          type="button"
          className="analytics-group-toggle"
          aria-expanded={expanded}
          aria-controls={`${group.id}-panel`}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${group.title}`}
          onClick={() => onToggle()}
        >
          <ChevronDown size={15} aria-hidden />
        </button>
      </div>

      <div id={`${group.id}-panel`} className={`analytics-fold${expanded ? '' : ' analytics-fold-closed'}`}>
        <div className="analytics-fold-inner">
          <div className="analytics-group-body">{children}</div>
        </div>
      </div>
    </section>
  );
}