---
name: Obsidian Edge
colors:
  surface: '#131b2e'
  surface-dim: '#0b1326'
  surface-bright: '#31394e'
  surface-container-lowest: '#060d20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3e'
  surface-container-highest: '#2d3449'
  on-surface: '#dbe2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dbe2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#bdc2ff'
  on-secondary: '#131e8c'
  secondary-container: '#2f3aa3'
  on-secondary-container: '#a8afff'
  tertiary: '#ffb783'
  on-tertiary: '#4f2500'
  tertiary-container: '#d97721'
  on-tertiary-container: '#452000'
  error: '#ef4444'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e0e0ff'
  secondary-fixed-dim: '#bdc2ff'
  on-secondary-fixed: '#000767'
  on-secondary-fixed-variant: '#2f3aa3'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#0b1326'
  on-background: '#dbe2fd'
  surface-variant: '#2d3449'
  success: '#22c55e'
  warning: '#f59e0b'
  info-ai: '#818cf8'
  border-subtle: '#ffffff1a'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  page-margin: 16px
---

## Brand & Style
The design system is engineered for the high-performance world of technical analysis and mobile trading. It adopts a **Modern-Corporate** aesthetic with **Minimalist** and **Glassmorphic** influences, prioritizing a "dark-first" interface to reduce eye strain and maximize the vibrance of data visualizations.

The personality is precise, technical, and analytical. It avoids decorative flourishes, using depth and subtle luminescence to guide the user's attention toward AI-driven insights and critical market movements. The visual narrative is one of "command and control," providing a calm, authoritative environment for high-stakes decision-making.

## Colors
The palette is optimized for OLED displays, utilizing a deep navy-charcoal foundation to create an infinite sense of depth.

- **Primary Indigo:** Reserved for high-priority actions, focus states, and the brand's core identity.
- **Surface Tiers:** The background uses the darkest navy (`#0b1326`), while interactive cards and containers use a slightly elevated slate (`#131b2e`).
- **Semantic Logic:** Success (Green) and Error (Red) colors are used sparingly for directional data (Profit/Loss). 
- **AI Accent:** A specific Info/AI Violet is used for intelligence-driven insights, often accompanied by a soft glow effect to differentiate automated suggestions from manual data.

## Typography
**Inter** is the sole typeface for this design system, chosen for its exceptional legibility in small sizes and high-density data environments. 

- **Display levels** are used for primary hero numbers (account balances, total profit) to provide immediate impact.
- **Title levels** are utilized for card headers and section titles to establish a clear hierarchy.
- **Label-caps** are essential for metadata, timestamps, and secondary status indicators, providing a "technical" feel without sacrificing space.
- For numerical data specifically, use the `tabular-nums` OpenType feature to ensure digits align vertically in lists and tables.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a strict **4px baseline rhythm**. This allows the interface to maintain high data density—vital for financial applications—while remaining organized.

- **Mobile Layout:** 4-column grid with a 16px side margin. Vertical rhythm should primarily use 12px or 16px gaps between related components.
- **Safe Areas:** Ensure interactive elements in the bottom navigation and top headers respect the device's hardware safe areas (notches and home indicators).
- **Density:** In data-heavy lists, padding can be reduced to 8px (sm) to maximize information visibility "above the fold."

## Elevation & Depth
Depth is created through **Tonal Layering** and **Luminescent Accents**. 

- **Surface Tiering:** The background is the lowest level. Cards and containers sit on top using the `#131b2e` surface color.
- **Outlines:** Instead of heavy shadows, components use a 1px subtle border (`#ffffff1a`) to define edges against the dark background.
- **Active Glow:** Interactive elements in an "active" or "focused" state (like bottom nav icons) utilize a soft indigo outer glow (12px-16px blur) to simulate a backlit digital display.
- **AI Elevation:** AI-specific components use a soft indigo left-border accent (2px-4px width) to visually "lift" the insight from standard data.

## Shapes
The design system uses a **Rounded (0.5rem)** base to balance professional rigor with modern mobile sensibilities.

- **Standard Elements:** Buttons, input fields, and small chips use the base 8px (0.5rem) radius.
- **Large Containers:** Content cards and bottom sheets use `rounded-2xl` (1.5rem / 24px) to create a soft, premium feel that frames the data.
- **Gradients:** Use subtle linear gradients on primary buttons to reinforce the sense of a physical, tactile surface.

## Components
- **Buttons:** Primary buttons are solid Indigo with a slight vertical gradient. Secondary buttons use a ghost style with a 1px border.
- **Cards:** All cards feature a `rounded-2xl` corner radius and a subtle `border-subtle` outline. AI-specific cards must include a vertical Indigo accent on the leading edge.
- **Bottom Navigation:** A glassmorphic bar with a high background blur. Active states are indicated by the icon changing to Primary Indigo with a matching soft glow beneath it.
- **Account Switcher:** Placed in the top-left or top-right of headers. Uses a circular avatar with a 1px border.
- **Charts:** Line and bar charts use 2pt stroke weights. Data points in bar charts should have a 2px top corner radius. Use the primary Indigo for the main data series and semantic colors for PnL indicators.
- **Input Fields:** Dark-filled with no background (just a border) or a slightly darker surface color. Labels should be small and positioned above the field or floating.
- **Chips:** Small, `rounded-lg` elements used for filtering or status labels, using low-opacity versions of the semantic colors for their backgrounds.