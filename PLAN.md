# ContrastCheck Enhancement Plan

## Overview

This plan addresses critical accessibility scanning gaps in ContrastCheck. It prioritizes the most impactful improvements that move the tool from a basic contrast checker to a thorough accessibility guardian.

## Core Philosophy

> "If I had asked people what they wanted, they would have said faster horses." — Henry Ford

Users ask for "better reports." What they need is **confidence that nothing was missed.**

---

## P0: Images & Gradients (Text Over Complex Backgrounds)

### Problem

```typescript
// Current code silently skips the most common modern UI pattern:
if (pair.background.startsWith('image:')) continue;
```

Hero sections, cards, overlays, and gradient buttons are invisible to the tool. Teams see "0 violations" while shipping unreadable text over photos.

### Root Cause

The extractor identifies `background-image` or gradients but cannot resolve them to a flat color. Instead of flagging for manual review, the tool ignores them entirely.

### Solution

Replace the `continue` with **pixel sampling** of the actual rendered background behind each text element.

### Implementation

#### 1. Capture & Analyze Strategy

| Strategy | Library | Purpose |
|----------|---------|---------|
| **Fast pixel sampling** | `sharp` | Extract RGB values from screenshot buffer at specific coordinates |
| **CSS gradient rendering** | `html-to-image` | Render DOM elements to canvas in-browser to capture computed gradients |
| **Dominant color inference** | `node-vibrant` | Smart extraction of main background colors from photos |

#### 2. Sampling Algorithm

**Option A (Fast):** Single center point of text bounding box.
**Option B (Balanced — Recommended):** 9-point grid (center + 8 surrounding points).
**Option C (Strict):** Full bounding box with min/avg/max contrast report.

**Recommended default: Option B**, with a `--strict-image-sampling` flag for Option C.

#### 3. High-Variance Handling

If sampled pixels have high variance (e.g., photo backgrounds), the report should include a warning:

> "Text over complex image — manual review recommended. Contrast varies across the text area."

#### 4. Coordinate Precision

- Use `window.devicePixelRatio` to map CSS pixels to screenshot pixels accurately.
- Scroll elements into view before sampling if below the fold.
- Account for `fullPage: true` screenshot offsets.

### Architecture

```
┌─────────────────────────────────────┐
│   Image & Gradient Analyzer         │
├─────────────────────────────────────┤
│                                     │
│  1. Full-page screenshot            │
│     (Playwright + sharp)            │
│                                     │
│  2. Map element bbox → pixels       │
│     (boundingRect × devicePixelRatio)│
│                                     │
│  3. Sample 9-point grid             │
│     (sharp.raw() buffer access)     │
│                                     │
│  4. Calculate contrast per sample   │
│     (existing calculateContrast)    │
│                                     │
│  5. Report worst-case + variance    │
│     (flag if σ² > threshold)        │
│                                     │
└─────────────────────────────────────┘
```

### Files to Modify

- `src/scanner/extractor.ts` — Stop skipping `image:` backgrounds; flag them for sampling.
- `src/scanner/crawler.ts` — Add screenshot capture step before color extraction.
- `src/analyzer/sampler.ts` — New module: `sampleBackgroundColors(element, screenshot)`.
- `src/scanner/types.ts` — Extend `ElementColorPair` with `sampledBackgrounds?: RGBA[]`.

### Open Questions

- Should `sharp` be added as a dependency, or use Playwright's built-in buffer + manual pixel math? **Recommendation: add `sharp`** (industry standard, ~10x faster).

---

## P1: Responsive Breakpoint Testing

### Problem

`-w 1280x720` is the only viewport. Mobile breakpoints often have different font sizes, stacked layouts, and altered colors that change contrast ratios.

### Solution

Support multiple named viewport presets and explicit multi-viewport scans.

### Interface

```bash
# Named presets (recommended default)
contrastcheck https://example.com --viewport mobile --viewport desktop

# Explicit sizes
contrastcheck https://example.com --viewport 390x844 --viewport 1280x720
```

### Preset Definitions

| Preset | Dimensions | Rationale |
|--------|------------|-----------|
| `mobile` | 390 × 844 | iPhone 14 / common mobile |
| `tablet` | 768 × 1024 | iPad / common tablet |
| `desktop` | 1280 × 720 | Default / small laptop |
| `wide` | 1920 × 1080 | Large monitor |

### Reporting

Each `AnalyzedPage` gains a `viewport` field. The HTML report includes viewport tabs. Violations are deduplicated by selector across viewports but flagged if they only fail at certain sizes.

```typescript
interface AnalyzedPage {
  // ... existing fields
  viewport: { width: number; height: number };
  viewportLabel?: string; // 'mobile', 'tablet', etc.
}
```

### Files to Modify

- `src/validation.ts` — Accept array of viewport strings.
- `src/commands/check.ts` — Loop over viewports; aggregate results.
- `src/report/generator.ts` — Add viewport switcher UI in HTML report.
- `src/scanner/types.ts` — Add viewport metadata.

### Performance Note

4 viewports = ~4× scan time. Acceptable for thoroughness. A future `--fast` mode could skip responsive testing.

---

## P2: Hover / Focus / Active State Testing

### Problem

Only the default state is scanned. Interactive elements (buttons, links, inputs) often have worse contrast in `:hover` or `:focus` because designers optimize for the default view.

### Solution

Identify interactive elements and programmatically trigger their pseudo-states, then re-extract colors.

### Two-Tier Implementation

#### Tier 1: CDP (Chromium DevTools Protocol) — Primary

```typescript
const client = await page.context().newCDPSession(page);

// Force pseudo-state without simulating mouse movement
await client.send('CSS.forcePseudoState', {
  nodeId: nodeId,
  forcedPseudoClasses: ['hover']
});

// Read computed styles while forced
const styles = await client.send('CSS.getComputedStyleForNode', { nodeId });
```

**Pros:** Fast, reliable, no mouse coordinate math. Used by Chrome DevTools itself.
**Cons:** Chromium-only.

#### Tier 2: Playwright Native Actions — Fallback

```typescript
await page.hover(selector);   // :hover
await page.focus(selector);   // :focus
await page.keyboard.press('Tab'); // :focus-visible
await element.dispatchEvent('mousedown'); // :active
```

**Pros:** Works in Firefox and WebKit.
**Cons:** Slower; hover might trigger tooltips/modals that obscure other elements.

### Discovery of Interactive Elements

Use `css-tree` + `postcss-selector-parser` to parse stylesheets and find selectors with `:hover`, `:focus`, `:active` rules. Map these to actual DOM elements.

```typescript
import * as csstree from 'css-tree';

const ast = csstree.parse(cssText);
csstree.walk(ast, (node) => {
  if (node.type === 'PseudoClassSelector' && node.name === 'hover') {
    // Extract parent selector for testing
  }
});
```

**Caveat:** Cross-origin stylesheets are blocked by CORS. Fallback to heuristics (`a`, `button`, `input`, `[role="button"]`).

### Reporting

Each element gains a `states` array:

```typescript
interface ElementStateResult {
  state: 'default' | 'hover' | 'focus' | 'active';
  color: string;
  background: string;
  contrastRatio: number;
  aa: boolean;
  aaa: boolean;
}
```

In the HTML report, show the **worst state** as the primary violation, with expandable detail for all states.

### Interface

```bash
# Opt-in (recommended default)
contrastcheck https://example.com --check-states hover,focus

# All states
contrastcheck https://example.com --check-states all

# Explicit opt-out (if ever made default)
contrastcheck https://example.com --skip-states
```

### Files to Modify

- `src/scanner/extractor.ts` — Add state-aware extraction mode.
- `src/scanner/browser.ts` — Add CDP session management.
- `src/scanner/crawler.ts` — Re-scan interactive elements per state.
- `src/commands/check.ts` — Add `--check-states` CLI option.
- `src/report/generator.ts` — Add state detail expander in UI.

### State Cleanup

Between each element, clear forced states to prevent contamination:

```typescript
await client.send('CSS.forcePseudoState', {
  nodeId: nodeId,
  forcedPseudoClasses: []
});
```

---

## P3: Brand Palette Preservation in Suggestions

### Problem

Current suggestions shift lightness in Oklch space without any knowledge of the brand's allowed colors. A suggestion might turn `#3B82F6` (brand blue) into `#1E3A5F` (ugly navy) — technically passing but visually off-brand.

### Solution

Constrain suggestions to colors that belong to the same semantic family as the original.

### Phase 1: Infer Palette from CSS Variables

The extractor already collects CSS custom properties. Group them by semantic role:

```typescript
// Inferred from variable names
const palette = {
  primary:   ['--color-primary-100', '--color-primary-500', '--color-primary-900'],
  text:      ['--text-default', '--text-muted', '--text-inverse'],
  background:['--bg-surface', '--bg-elevated', '--bg-overlay'],
};
```

Use regex heuristics on variable names:
- `primary`, `brand` → primary family
- `text`, `fg`, `foreground` → text family
- `bg`, `background`, `surface` → background family

### Phase 2: Constrained Suggestion

When a failing color is a CSS variable:

1. Look up its semantic family.
2. Find the closest passing color within the same family (by perceptual distance in Oklch).
3. Suggest that variable value instead of an arbitrary generated color.

```typescript
function suggestConstrainedFix(
  failingColor: RGBA,
  backgroundColor: RGBA,
  variableName: string,
  palette: SemanticPalette
): SuggestedFix | null {
  const family = inferFamily(variableName);
  const candidates = palette[family] || [];
  
  // Find the closest passing color in the same family
  let best: SuggestedFix | null = null;
  for (const candidate of candidates) {
    const ratio = calculateContrast(candidate, backgroundColor).ratio;
    if (ratio >= threshold) {
      const distance = oklchDistance(failingColor, candidate);
      if (!best || distance < best.deltaE) {
        best = { color: candidate, hex: rgbToHex(candidate), ratio, property, deltaE: distance };
      }
    }
  }
  return best;
}
```

### Phase 3: External Palette File (Future)

```bash
contrastcheck https://example.com --palette ./brand-palette.json
```

```json
{
  "primary":   ["#3B82F6", "#2563EB", "#1D4ED8"],
  "text":      ["#1E293B", "#334155", "#64748B"],
  "background":["#FFFFFF", "#F8FAFC", "#F1F5F9"]
}
```

### Files to Modify

- `src/scanner/extractor.ts` — Enhance variable collection with semantic grouping.
- `src/analyzer/suggest.ts` — Add `suggestConstrainedFix` function.
- `src/commands/check.ts` — Add `--palette` CLI option (Phase 3).

### Fallback

If no palette is inferable or no passing color exists in the family, fall back to the current Oklch lightness shift.

---

## New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `sharp` | `^0.33.0` | Fast pixel sampling from screenshots |
| `css-tree` | `^2.3.0` | Parse stylesheets to find `:hover` rules |
| `postcss-selector-parser` | `^6.0.0` | Extract base selectors from pseudo-class rules |
| `html-to-image` | `^1.11.0` | Render DOM elements to canvas for gradient capture |
| `node-vibrant` | `^3.2.0` | Dominant color extraction from photos (optional) |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/sharp` | `^0.32.0` | TypeScript types for sharp |

---

## Implementation Order

| Priority | Feature | Rationale |
|----------|---------|-----------|
| **P0** | Images & Gradients | Biggest false-negative; users currently think they are clean when they are not |
| **P1** | Multiple Viewports | Low complexity, high impact; foundation for responsive-aware reporting |
| **P2** | Hover/Focus States | Critical for accessibility but complex; build on P0/P1 infrastructure |
| **P3** | Brand Palette Preservation | Nice-to-have polish; depends on P2 being stable |

---

## Testing Strategy

### Unit Tests

- `src/analyzer/sampler.test.ts` — Pixel sampling accuracy, coordinate math, variance calculation.
- `src/analyzer/contrast.test.ts` — Extend with sampled background test cases.
- `src/scanner/states.test.ts` — Mock CDP responses, verify pseudo-state forcing.

### E2E Tests

- Fixture pages with:
  - White text over a photo hero section
  - Gradient background button
  - Hover state color change
  - Mobile-only contrast failure (small font + tight ratio)
- Assert that violations are caught and reported correctly.

### Performance Benchmarks

- Baseline: scan time for a medium-complexity page at 1280×720.
- Target overhead:
  - Image sampling: < 20% per element with image background
  - Multi-viewport: ~linear with viewport count
  - State testing: < 30% per interactive element

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `sharp` native dependency breaks in some CI images | Medium | High | Provide pure-JS fallback using Playwright buffer + manual pixel math |
| CDP `forcePseudoState` unstable across Chromium versions | Low | High | Maintain Tier 2 Playwright fallback; feature-detect CDP availability |
| Full-page screenshots OOM on very long pages | Medium | Medium | Paginate screenshots or cap at `fullPage: false` with scroll-and-stitch |
| Cross-origin stylesheets prevent hover discovery | High | Medium | Fallback to tag/role heuristics (`a`, `button`, `[role="button"]`) |
| Sampling gradient edges gives misleading results | Medium | Low | Use 9-point grid + variance warning; user can `--strict-image-sampling` |

---

## Success Metrics

After implementation, the tool should:

1. **Catch 100% of text-over-image contrast failures** that are visually detectable.
2. **Report hover/focus violations** on interactive elements when `--check-states` is used.
3. **Support at least 3 viewports** in a single run with deduplicated reports.
4. **Suggest on-brand colors** when CSS variables from a design system are detected.
5. **Maintain < 2× scan time** for a typical page with all features enabled.

---

## Open Decisions

1. **Image sampling strategy:** 9-point grid (balanced) or full bounding box (strict)?
   - **Recommendation:** 9-point grid default; `--strict-image-sampling` for full box.

2. **State testing default:** Opt-in (`--check-states`) or default with `--skip-states`?
   - **Recommendation:** Opt-in to preserve fast default scans.

3. **Viewport interface:** Named presets, explicit list, or both?
   - **Recommendation:** Both. Named presets for convenience; explicit `--viewport` for flexibility.

4. **Palette source:** Infer from CSS variables only, or also support `--palette file.json`?
   - **Recommendation:** Start with CSS variable inference. Add `--palette` in a follow-up.

5. **Multi-browser state testing:** Is Chromium-only acceptable, or must Firefox/WebKit be supported?
   - **Recommendation:** Chromium-only for state testing initially. Document limitation; add fallback later.

---

*Plan version: 1.0*
*Last updated: 2026-05-13*
