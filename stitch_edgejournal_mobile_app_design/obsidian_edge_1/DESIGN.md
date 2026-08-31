---
name: Obsidian Edge
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb2b7'
  on-tertiary: '#67001b'
  tertiary-container: '#ff516a'
  on-tertiary-container: '#5b0017'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 16px
  gutter: 12px
  section-gap: 24px
---

## Brand & Style

The design system is engineered for the high-stakes environment of professional trading, where clarity and focus are paramount. It adopts a **Minimalist-Corporate** hybrid aesthetic, prioritizing a "dark-first" interface that reduces eye strain during long sessions. The visual language is inspired by professional operating systems: precise, restrained, and high-performance.

The style leverages heavy whitespace (in a dark context), high-quality utilitarian typography, and subtle tactile elements. It avoids unnecessary decoration, using depth and contrast only to highlight critical data points and AI-driven insights. The goal is to evoke an emotional response of calm authority and analytical rigor.

## Colors

The palette is anchored in a deep charcoal and slate foundation to ensure maximum legibility for data-dense charts and tables.

- **Primary (Indigo):** Used for primary actions and focused states.
- **Success (Emerald):** A muted, professional green for profit and positive growth, avoiding "neon" distractions.
- **Danger (Rose):** A sophisticated coral-red for losses and risk indicators.
- **AI Intelligence (Violet):** Dedicated to AI-generated insights and predictive badges.
- **Backgrounds:** The interface uses a layered approach with `#020617` (Deepest) for the canvas and `#0F172A` (Slate) for primary containers.

## Typography

This design system utilizes **Inter** for all UI elements to ensure maximum readability across varying pixel densities. For financial data, price points, and timestamps, **JetBrains Mono** is introduced to provide tabular figures that align perfectly in vertical columns, facilitating quick numerical scanning.

Scale is used aggressively to create a clear information hierarchy. Secondary data points use reduced opacity (60-70%) rather than smaller font sizes to maintain accessibility while indicating lower importance.

## Layout & Spacing

The system employs a **Fluid Grid** model with a base unit of 4px. This allows for the high data density required by professional traders without sacrificing balance.

- **Mobile:** A 4-column grid with 16px margins. Bottom-heavy navigation ensures critical tools are within thumb-reach.
- **Desktop/Tablet:** A 12-column grid. Sidebars are reserved for navigation and filtering, while the central area expands to accommodate complex charts.
- **Density:** Spacing is tighter than consumer apps (8px–12px between elements) to allow more information to be visible above the fold.

## Elevation & Depth

Depth is conveyed through **Tonal Layering** and **Ghost Borders** rather than heavy shadows.

- **Surface Levels:** The background is the darkest layer. Containers (cards, sidebars) sit one step lighter.
- **Borders:** Surfaces are defined by 1px solid borders in a low-contrast slate (`#1E293B`). This provides structure without visual noise.
- **Active States:** Elements in focus or "active" states utilize a soft, 20% opacity primary-colored outer glow to simulate a backlit effect.
- **Glassmorphism:** Reserved exclusively for mobile bottom sheets and overlays to maintain context of the data beneath.

## Shapes

The shape language is **Soft (0.25rem)**. This provides a modern, professional feel that is more approachable than sharp 90-degree corners, but remains more "serious" and tool-like than fully rounded or pill-shaped systems.

- **Small Components:** Buttons, inputs, and chips use a 4px (0.25rem) radius.
- **Containers:** Large cards and bottom sheets use an 8px (0.5rem) radius to define major content areas.
- **Selection Indicators:** Tab highlights and active state markers use sharp corners to emphasize precision.

## Components

- **Trade Cards:** High-density components featuring a "Status Pillar" (a 4px vertical success/danger bar on the left edge). Key metrics (RR, PnL) are displayed in JetBrains Mono.
- **AI Insight Badges:** Pill-shaped labels using the Violet accent with a subtle 10% background tint and a glow-effect icon.
- **Action Buttons:** Primary buttons are solid Indigo. Secondary buttons use the "Ghost" style (transparent background, 1px border).
- **Data Tables:** Minimalist layout with no vertical borders. Row hover states use a subtle lightening of the background (`#1E293B`).
- **Form Controls:** Inputs are dark-filled with bottom-aligned labels. Active states transition the border color to the Primary Indigo.
- **Bottom Navigation:** A high-blur translucent bar with haptic-ready icons. The "Add Trade" button is centered and elevated with a slight Primary gradient.
- **Profit/Loss Indicators:** Always accompanied by a directional icon (up/down arrow) to ensure accessibility for color-blind users.