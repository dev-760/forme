# FORME — Frontend Design System & Architecture Specification

> **Version:** 1.0.0  
> **Aesthetic:** Minimalist Luxury / Digital Wardrobe Atelier  
> **Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Bespoke CSS, Lucide Icons  

---

## 1. Executive Vision & Philosophy

**FORME** is designed as a quiet, editorial digital atelier for personal wardrobe management and AI styling. Rather than feeling like a utility database or e-commerce inventory, FORME evokes the considered elegance of luxury fashion houses and editorial publications (such as *Totême, Lemaire, SSENSE,* and *Aesop*).

### Core Tenets
1. **Consideration over Clutter:** Every garment is treated with curatorial dignity. Ample negative space, disciplined borders, and subtle contrast prevent sensory overload.
2. **Editorial Typography:** Pairing contemporary neo-grotesque structural typography with an expressive luxury serif italic accent provides immediate editorial sophistication.
3. **Tactile Digital Surfaces:** Deep obsidian and slate backgrounds paired with muted botanical sage accents (`#a8b99a`) and warm ivory text (`#f4f2ed`) simulate physical garment tags, linen paper, and textured fabric.
4. **Seamless AI Partnership:** Artificial intelligence acts as an unobtrusive atelier assistant—quietly cataloging fabrics, tags, and colors, and suggesting looks inspired by current weather and personal preferences.

---

## 2. Brand Identity & Monogram System

### 2.1 The FORME Emblem
The brand mark is an architectural monogram blending three symbolic motifs into a geometric squircle:
- **Tailored Coat Hanger Hook:** A delicate curved arc at the apex symbolizing wardrobe care.
- **Tailored Shoulder / Lapel Silhouette:** Angled structural lines evoking structured outerwear and bespoke tailoring.
- **Architectural "F" Monogram:** Crisp ivory letterform anchored by a botanical sage crossbar and accent stitch dot.

```
┌─────────────────────────────────┐
│           ╭──────╮              │  <- Hanger hook arc
│          ╱   /\   ╲             │  <- Tailored shoulder slope
│         │   |  |   │            │
│         │   |━━●   │            │  <- Botanical sage crossbar & stitch
│         │   |      │            │  <- Architectural stem
│         ╰──────────╯            │
└─────────────────────────────────┘
```

### 2.2 Brand Lockup Configurations
- **Emblem Mark:** [`app/components/brand.tsx`](file:///c:/Users/Hassan/Desktop/FORME/frontend/app/components/brand.tsx) (`FormeMark`)
- **Horizontal Wordmark:** `FORME` in tracked Manrope (`letter-spacing: 0.2em`) accompanied by the sub-label `ATELIER` or `WARDROBE ATELIER` in botanical sage (`#a8b99a`).
- **Static Vector Files:**
  - App Favicon / PWA Icon: [`public/forme-icon.svg`](file:///c:/Users/Hassan/Desktop/FORME/frontend/public/forme-icon.svg)
  - Full Brand Lockup: [`public/logo.svg`](file:///c:/Users/Hassan/Desktop/FORME/frontend/public/logo.svg)

---

## 3. Design Tokens & Visual Hierarchy

### 3.1 Typography Stack

| Role | Font Family | Weights | Usage & Characteristics |
| :--- | :--- | :--- | :--- |
| **Editorial Display** | `Cormorant Garamond` | 500, 600 (Italic) | Applied to `em` elements within `h1`, `h2`, hero titles, and login headlines for high-fashion editorial cadence. |
| **Headings & Structure** | `Manrope` | 500, 600, 700 | Primary structural headings (`h1`, `h2`, `h3`, brand text). Tight tracking (`-0.03em` to `-0.05em`). |
| **Body & UI** | `DM Sans` | 400, 500, 600 | General interface copy, forms, toolbars, buttons, and navigation. Highly legible at small sizes. |
| **Metadata & Keycaps** | System Monospace | 400 | Search shortcuts (`<kbd>/</kbd>`), category counts, and technical badges. |

### 3.2 Color Palette

#### Base & Surface Colors
```css
--bg:             #0b0c0b;  /* Deepest obsidian black */
--sidebar:        #0f110f;  /* Subtle charcoal-tinted dark sidebar */
--surface:        #151715;  /* Primary container & card surface */
--surface-hover:  #1b1e1b;  /* Interactive hover state */
--raised:         #1e211e;  /* Elevated elements & input fields */
```

#### Line & Border Tokens
```css
--line:           #272b27;  /* Structural border, 1px solid */
--line-subtle:    #1f221f;  /* Soft divider & secondary borders */
```

#### Typography & Content Tones
```css
--text:           #f4f2ed;  /* Warm ivory / alabaster (high contrast) */
--muted:          #a3a6a0;  /* Secondary readable descriptive text */
--dim:            #737771;  /* Tertiary captions, metadata, dates */
```

#### Accent & Semantic Tones
```css
--sage:           #a8b99a;  /* Signature atelier botanical sage */
--sage-hover:     #bed0b0;  /* Active button hover */
--sage-tint:      rgba(168, 185, 154, 0.12); /* Soft pill & badge background */
--danger:         #c97a7a;  /* Destructive action warning */
--amber:          #c9a66b;  /* Warm highlight / status accent */
```

#### Garment Swatch Mapping (`COLOR_MAP`)
Garments automatically display a micro-swatch dot corresponding to their primary or tagged colors:
- **Neutrals:** Black (`#18181b`), White (`#f5f5f4`), Ivory (`#fffff0`), Cream (`#f3efe0`), Off-White (`#f0ece1`), Charcoal (`#3f3f46`), Grey (`#71717a`)
- **Earth & Leather:** Camel (`#b99364`), Tan (`#c8ad88`), Beige (`#d9ccb4`), Taupe (`#8b7d70`), Brown (`#6b4c3b`), Khaki (`#b5ab88`)
- **Botanicals & Blues:** Sage (`#a8b99a`), Olive (`#6b7856`), Green (`#4d7c5d`), Navy (`#1e293b`), Denim (`#476b8f`), Blue (`#3b82f6`), Light Blue (`#93c5fd`)
- **Warm Accents:** Burgundy (`#6b2130`), Red (`#b93838`), Blush (`#e4b7be`), Coral (`#d97762`), Mustard (`#c49a38`), Gold (`#c7a354`)

### 3.3 Elevation, Shadows & Radii
- **Border Radii:**
  - Micro / Badges: `5px` – `7px`
  - Form Inputs & Buttons: `8px` – `9px`
  - Cards & Sections: `12px` – `14px`
  - Pills & Modals: `999px` (Pill) / `14px` – `16px` (Modal)
- **Shadows:**
  - Card Shadow: `0 12px 32px -12px rgba(0, 0, 0, 0.55)`
  - Modal Elevation: `0 28px 70px -16px rgba(0, 0, 0, 0.78)`
  - Sage Button Glow: `0 4px 16px rgba(168, 185, 154, 0.18)`

---

## 4. Layout Architecture & App Shell

```
┌────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR (248px)       │ TOPBAR (Sticky 64px, Glassmorphic Blur 16px)   │
│                       ├────────────────────────────────────────────────┤
│ [FORME ATELIER]       │ Breadcrumb: FORME / Dashboard   [Weather] [Me] │
│                       ├────────────────────────────────────────────────┤
│ YOUR ATELIER          │ PAGE CONTENT (max-width: 1380px, auto-centered)│
│ • Dashboard           │                                                │
│ • Add clothing    [+] │  [Welcome Hero]                [Weather Chip]  │
│ • My wardrobe   [142] │  ────────────────────────────────────────────  │
│ • AI stylist          │  [Today, Considered — Recommendation Hero]     │
│ • Outfits             │  [Latest Additions]      [Atelier Metrics]     │
│ • Preferences         │  [Wardrobe Color Palette Analysis]             │
│                       │                                                │
│ ────────────────────  │                                                │
│ • Live season status  │                                                │
│ [Profile / Account ▾] │                                                │
└───────────────────────┴────────────────────────────────────────────────┘
```

### 4.1 Shell Components
1. **Sidebar (`aside.sidebar`):**
   - Width: `248px` desktop, pinned left with vertical linear gradient.
   - Contains Brand Lockup, categorized navigation links with active state pill glows, live piece count badges, and an anchored account settings row.
2. **Topbar (`header.topbar`):**
   - Height: `64px` with `backdrop-filter: blur(16px)` and 85% opacity obsidian base.
   - Breadcrumb navigation (`FORME / [Page Name]`), real-time weather summary pill, formatted calendar date, and user monogram avatar.
3. **Mobile Drawer & Bottom Bar:**
   - Under `800px`, the desktop sidebar transitions to an off-canvas drawer (`transform: translateX(-100%)`).
   - Sticky mobile bottom navigation (`nav.mobile-bottom-nav`) gives one-thumb access to the 5 primary tabs with iOS safe-area support (`calc(6px + env(safe-area-inset-bottom))`).

---

## 5. View Specifications & Core Modules

### 5.1 Login & Onboarding (`/login`)
- **Layout:** Split editorial composition (`1.15fr : 0.85fr`).
- **Left Column (Atelier Editorial):**
  - Large Brand Lockup (`FormeBrand large`).
  - Expressive headline with Cormorant Garamond: *"Dress like yourself."*
  - Value pillars highlighting *Visual Archive* and *Weather & Occasion Styling*.
- **Right Column (Access Card):**
  - OIDC Single Sign-On button with subtle shine and icon indicators.
  - Development fallback form for rapid local test sessions.
  - Encrypted session security indicator.

### 5.2 Dashboard (`/dashboard`)
- **Welcome Row:** Time-of-day contextual greeting (`Good morning / afternoon / evening, [Name]`), localized weather badge with temperature and sky conditions.
- **"Today, Considered" Outfit Recommendation:**
  - High-impact split hero card (`1.05fr : 0.95fr`).
  - Left panel: Occasion badge, title, AI stylist reasoning notes, item thumbnail chips with quick inspection, and "Inspect outfit" / "Save look" actions.
  - Right panel: Adaptive multi-garment collage supporting 1 to 4 pieces with hover captions.
- **Dashboard Lower Grid:**
  - **Recent Additions:** 4-column preview of newly cataloged garments with 1-click details modal.
  - **Atelier Metrics:** Large numeral piece counter, wears logged count, favorited pieces, and saved look count.
- **Wardrobe Color Palette Analysis:**
  - Visual breakdown of the user's top 6 most-worn colors, rendered with color swatches and proportional width bars.

### 5.3 Add Clothing (`/wardrobe/add`)
- **Upload Zone:**
  - Drag-and-drop target with subtle dashed border and radial sage glow.
  - File picker accepting JPEG, PNG, WebP, HEIC up to configured server limit (default 50MB).
  - Preview card with file size, thumbnail, and replace/remove actions.
- **AI Processing Guarantee:**
  - Explanatory callout for automatic category classification, fabric analysis, color extraction, and background handling.
  - Helpful photography tips (natural light, single garment, simple backdrop).

### 5.4 My Wardrobe (`/wardrobe`)
- **Toolbar & Filtering Controls:**
  - Search input with quick keyboard shortcut trigger (<kbd>/</kbd>) and clear button.
  - Heart toggle for favorited pieces.
  - Dynamic dropdown filters for extracted colors and seasons.
  - Category tabs (`All`, `Tops`, `Bottoms`, `Outerwear`, `One piece`, `Shoes`, `Accessories`) displaying live item counts.
- **Garment Grid:**
  - 5-column responsive grid on desktop (`wardrobe-grid`).
  - Cards feature smooth hover zoom (`scale(1.035)`), brand pills, favorite bookmark button, color dots, and wear counters.

### 5.5 AI Stylist (`/stylist`)
- **Occasion Bar:** Dropdown selection for 22 occasions (casual, office, formal, date, lounge, travel, etc.) paired with live weather context.
- **Generated Look Showcase:**
  - Grid presentation of suggested pieces.
  - Stylist narrative explaining *why* the combination works (color harmony, layering for current weather, silhouette balance).
  - Save to lookbook and interactive rating actions.

### 5.6 Outfits Lookbook (`/outfits`)
- Curated collection of accepted or saved combinations.
- 3-column grid of outfit cards displaying composite garment thumbnails, occasion tag, piece count, and direct inspection trigger.

### 5.7 Preferences & Settings (`/settings`)
- Profile details (display name, email, location for weather).
- Temperature unit toggle (Celsius / Fahrenheit).
- Styling Sensibilities: Layering preference (light, balanced, structured), variety preference, and under-worn garment prioritization toggle.
- Extended Modules: Outfit reminder notifications, household wardrobe sharing, and fine-grained style attribute sliders.

---

## 6. Modals & Inspection Overlays

### 6.1 Garment Detail Inspector
- **Trigger:** Clicking any garment card in Wardrobe, Dashboard, or Outfit views.
- **Layout:** Two-column split dialog (`0.92fr : 1.08fr`) with blurred backdrop.
- **Left Panel:** High-resolution zoom of the garment photo.
- **Right Panel:**
  - Garment status and title.
  - Editable metadata fields: Name, Category, Subtype, Brand, Colors, Pattern, Material, Style Tags, Season, Notes.
  - Activity loggers: **"Log wear"**, **"Log wash"**, and wear counter.
  - **"Find pairings"** button: Asynchronously queries the backend for 3 complementary garments from the user's wardrobe.
  - Destructive action: "Remove piece" with confirmation safeguard.

### 6.2 Outfit Inspection & Feedback Modal
- Visual review of all pieces in the outfit.
- Stylist reasoning summary.
- **5-Star Rating System:** Allows users to provide interactive feedback on how the look felt.
- **"Mark as worn today"** button: Automatically updates wear logs across all included garments.

---

## 7. Keyboard Navigation & Accessibility

- **<kbd>/</kbd> (Forward Slash):** Automatically focuses the search bar on `/wardrobe`.
- **<kbd>Esc</kbd> (Escape):** Closes any open garment or outfit detail modal.
- **<kbd>Enter</kbd> / <kbd>Space</kbd>:** Triggers card selection when focused.
- **Focus Rings:** High-visibility 2px sage outline (`outline: 2px solid var(--sage); outline-offset: 2px`) for keyboard accessibility.
- **Motion Reduction:** Full `@media (prefers-reduced-motion: reduce)` support disabling all transitions and infinite animations.

---

## 8. Responsive Breakpoints

| Breakpoint | Target Devices | Layout Adaptations |
| :--- | :--- | :--- |
| **`> 1120px`** | Desktop / Large displays | Full 248px sidebar, 5-column wardrobe grid, 4-column outfit looks. |
| **`861px – 1120px`** | Small laptops / Tablets (Landscape) | 220px sidebar, 4-column wardrobe grid, compact padding. |
| **`541px – 860px`** | Tablets (Portrait) / Foldables | Off-canvas sidebar drawer, sticky bottom navigation bar, 3-column wardrobe grid, stacked recommendation hero. |
| **`≤ 540px`** | Mobile Phones | 2-column garment grid, full-width search and filters, stacked forms, single-column modal sheets. |

---

## 9. File Directory Reference

```
FORME/frontend/
├── app/
│   ├── components/
│   │   └── brand.tsx              # FormeMark & FormeBrand vector components
│   ├── api/auth/[...nextauth]/
│   │   └── route.ts               # NextAuth OIDC & session synchronization
│   ├── dashboard/page.tsx         # Re-export of SPA root
│   ├── wardrobe/
│   │   ├── page.tsx               # Re-export of SPA root
│   │   └── add/page.tsx           # Re-export of SPA root
│   ├── stylist/page.tsx           # Re-export of SPA root
│   ├── outfits/page.tsx           # Re-export of SPA root
│   ├── settings/
│   │   ├── page.tsx               # Re-export of SPA root
│   │   └── extras.tsx             # Schedules, household sharing & style notes
│   ├── layout.tsx                 # Root layout, viewport & favicon links
│   ├── page.tsx                   # Core SPA orchestrator & state manager
│   ├── providers.tsx              # NextAuth SessionProvider wrapper
│   └── styles.css                 # Master design system & component styles
├── public/
│   ├── forme-icon.svg             # Monogram emblem favicon & PWA icon
│   └── logo.svg                   # Full horizontal brand lockup
├── .env.local                     # Environment variables
└── package.json                   # Dependencies & scripts
```
