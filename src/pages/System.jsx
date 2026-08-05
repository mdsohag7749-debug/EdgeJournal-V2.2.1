import Settings from './Settings';

// System is now a section inside the merged Settings page. This thin
// wrapper keeps the existing /system route (still reached from the
// sidebar and Dashboard's "Import") landing directly on the System
// section, so nothing breaks and no settings are lost.
export default function System() {
  return <Settings defaultSection="system" />;
}