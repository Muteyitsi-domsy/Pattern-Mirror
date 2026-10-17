# Pattern Mirror: UI/UX Design System

**Version:** 1.0  
**Inspiration:** testgorilla.com (clean, minimal, professional)  
**Philosophy:** Elegant simplicity. Beautiful without being precious. Approachable, sophisticated.

---

## 1. Design Principles

1. **Clarity Over Decoration** — No unnecessary elements, no animations, no "wow" factors that distract
2. **Whitespace is Content** — Generous padding, breathing room between elements
3. **Professional But Warm** — Corporate-ready, but not cold. Inviting, not sterile
4. **Single-Purpose Pages** — One focus per screen, clear next action
5. **Error-First UX** — Errors caught early, feedback immediate, recovery obvious
6. **Mobile-First** — Works beautifully on phone, scales up elegantly

---

## 2. Color Palette

### Primary: Sunset Warm Accent
```
Name: Warm Coral / Peachy Sunset
Hex: #E8956B
RGB: 232, 149, 107
Usage: Buttons, section titles, focus states, highlights, call-to-action

Hover state: #D87F5B (darker)
Active state: #C86A4B (even darker)
Disabled: #E8956B with 40% opacity
```

### Neutral: Clean, Spacious
```
Off-white (Background): #FAFAFA
RGB: 250, 250, 250

Soft Gray (Secondary text): #6B7280
RGB: 107, 114, 128

Dark Charcoal (Primary text): #1F2937
RGB: 31, 41, 55

Light Border: #E5E7EB
RGB: 229, 231, 235

Medium Border: #D1D5DB
RGB: 209, 213, 219
```

### Semantic Colors
```
Success (green): #10B981
Warning (amber): #F59E0B
Error (red): #EF4444
Info (blue): #3B82F6
```

---

## 3. Typography

### Font Family
```
Primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif
(System fonts: fast, native feel on each platform)

Fallback: "Segoe UI", sans-serif
```

### Type Scale
```
Heading 1 (h1):
  Size: 32px
  Weight: 600 (semi-bold)
  Line-height: 1.2
  Color: #1F2937
  Margin-bottom: 24px
  Usage: Page titles, main heading

Heading 2 (h2):
  Size: 24px
  Weight: 600
  Line-height: 1.3
  Color: #1F2937
  Margin-bottom: 16px
  Usage: Section titles, "Your report is ready!"

Heading 3 (h3):
  Size: 18px
  Weight: 600
  Line-height: 1.4
  Color: #1F2937
  Margin-bottom: 12px
  Usage: Sub-section headings

Body (p):
  Size: 16px
  Weight: 400
  Line-height: 1.6
  Color: #1F2937
  Margin-bottom: 16px
  Usage: Main content, paragraphs

Small (small, label, caption):
  Size: 14px
  Weight: 400
  Line-height: 1.5
  Color: #6B7280
  Usage: Helper text, labels, captions

Accent labels (on dark):
  Size: 14px
  Weight: 600
  Color: #E8956B
  Usage: Labels, status badges
```

### Hierarchy Example
```
┌─────────────────────────────────────────────┐
│                                              │
│  Upload Your Journals              (h1)     │
│                                              │
│  Select a data type                 (h2)    │
│                                              │
│  Choose from Structured,            (small) │
│  Semi-structured, or Unstructured           │
│                                              │
│  ☐ Structured                       (label) │
│    CSV/JSON data with pre-labeled           │
│    mood and life area data.         (body)  │
│                                              │
│  [Continue]                      (button)   │
└─────────────────────────────────────────────┘
```

---

## 4. Spacing & Layout

### Spacing Scale (8px base)
```
8px   → xs  (padding in small buttons)
12px  → sm  (vertical space in cards)
16px  → md  (standard padding, margins)
24px  → lg  (section spacing)
32px  → xl  (major section break)
40px  → 2xl (page margins)
48px  → 3xl (very large spacing)
```

### Container
```
Max-width: 800px
Padding: 40px horizontal (on desktop)
Padding: 20px horizontal (on mobile)
Margin: 0 auto (centered)
```

### Grid
```
Single column (mobile first)
Two columns at 768px+ (for compare/contrast)
Never three columns (too narrow, hard to read)
Gutter: 16px
```

---

## 5. Components

### Buttons

**Primary Button (Call-to-Action)**
```
Background: #E8956B
Text: White, 16px, semi-bold
Padding: 12px 24px
Border-radius: 6px
Border: none
Cursor: pointer
Hover: #D87F5B (background darkens)
Active: #C86A4B
Disabled: #E8956B with 40% opacity, cursor: not-allowed

Example:
<button class="btn btn-primary">Continue</button>
```

**Secondary Button**
```
Background: #F3F4F6 (light gray)
Text: #1F2937 (dark)
Padding: 12px 24px
Border-radius: 6px
Border: 1px solid #E5E7EB
Hover: #E5E7EB (background lightens)
Active: #D1D5DB

Example:
<button class="btn btn-secondary">Cancel</button>
```

**Tertiary Button (Subtle)**
```
Background: transparent
Text: #E8956B
Padding: 12px 0 (no padding, just text)
Border: none
Hover: Text color #D87F5B, underline
Active: #C86A4B

Example:
<button class="btn btn-tertiary">Learn more</button>
```

### Input Fields

**Text Input**
```
Font-size: 16px
Padding: 12px 16px
Border: 1px solid #D1D5DB
Border-radius: 6px
Background: white
Focus: Border #E8956B (2px solid), box-shadow: 0 0 0 3px rgba(232, 149, 107, 0.1)
Placeholder: #9CA3AF (lighter gray)
```

**Select Dropdown**
```
Same styling as text input
Arrow icon: #6B7280
Hover: Border becomes #9CA3AF
```

### Cards

**Standard Card**
```
Background: white
Padding: 24px
Border-radius: 8px
Border: 1px solid #E5E7EB
Box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) (very subtle)
Margin-bottom: 16px

Title inside card: h3, margin-bottom: 12px
Content: body text
```

### Progress Bar

**Linear Progress**
```
Height: 8px
Background: #E5E7EB
Bar color: #E8956B
Border-radius: 4px
Smooth fill animation (no jumpy updates)

Label above: "40% complete"
Below: "Current phase: Analyzing patterns..."
```

### Badges / Tags

**Status Badge (small)**
```
Background: #E8956B with 10% opacity
Text: #E8956B
Padding: 4px 8px
Border-radius: 4px
Font-size: 12px
Font-weight: 600

Examples:
✓ Ready (green)
⏳ Processing (amber)
✗ Failed (red)
```

### Modal / Overlay

**When needed (rare):**
```
Overlay: Transparent black, 30% opacity
Modal background: white
Padding: 32px
Border-radius: 12px
Box-shadow: 0 20px 25px rgba(0, 0, 0, 0.1)
Close button: X in top-right, color #6B7280
```

---

## 6. Layout Patterns

### Form Page
```
┌──────────────────────────────────┐
│   [Logo] Pattern Mirror           │
│   (small, top-left)               │
│                                  │
│   === 40px vertical padding ===  │
│                                  │
│   Upload Your Journals       (h1)│
│   (Centered, warm accent color)  │
│                                  │
│   === 24px ===                   │
│                                  │
│   Select data type          (h2) │
│   (Warm accent color)            │
│                                  │
│   ☐ Structured              (card)
│   ☐ Semi-structured         (card)
│   ☐ Unstructured            (card)
│                                  │
│   === 24px ===                   │
│                                  │
│   [Drag file here or click]      │
│   (Input field, dashed border)   │
│                                  │
│   === 24px ===                   │
│                                  │
│   Focus Questions           (h2) │
│   (max 800px, centered)          │
│   (Dropdown 1) [▼]               │
│   (Dropdown 2) [▼]               │
│                                  │
│   === 24px ===                   │
│                                  │
│   [Continue] [Cancel]     (buttons)
│   (Continue is primary, warm)    │
│   (Cancel is secondary, gray)    │
│                                  │
│   === 40px ===                   │
└──────────────────────────────────┘
```

### Processing Page
```
┌──────────────────────────────────┐
│   [Logo] Pattern Mirror           │
│                                  │
│   === 40px ===                   │
│                                  │
│   Your report is being           │
│   analyzed...                (h1)│
│                                  │
│   [████░░░░░░] 40% complete      │
│   Current phase: Analyzing...    │
│   Estimated time: 8 minutes      │
│                                  │
│   === 32px ===                   │
│                                  │
│   ┌─────────────────────────────┐│
│   │ Wait here for instant       ││
│   │ download when done          ││
│   │                             ││
│   │ [⏱ Wait]      [📧 Email me]││
│   └─────────────────────────────┘│
│                                  │
│   === 40px ===                   │
└──────────────────────────────────┘
```

### Completion Page
```
┌──────────────────────────────────┐
│   [Logo] Pattern Mirror           │
│                                  │
│   === 40px ===                   │
│                                  │
│   ✓ Your report is ready!    (h1)│
│   (Checkmark in warm accent)     │
│                                  │
│   === 24px ===                   │
│                                  │
│   [Download PDF] [View Browser]  │
│   (Download is primary, warm)    │
│                                  │
│   === 32px ===                   │
│                                  │
│   Summary:                   (h3)│
│   45 journal entries analyzed    │
│   3-month period                 │
│   Processing time: 8 minutes     │
│                                  │
│   === 40px ===                   │
│                                  │
│   Past Reports               (h3)│
│   ┌─────────────────────────────┐│
│   │ June 14, 2025 ✓   [Download]││
│   │ (card)          [Regenerate]││
│   └─────────────────────────────┘│
│   ┌─────────────────────────────┐│
│   │ June 7, 2025 ✓   [Download] ││
│   │ (card)          [Regenerate]││
│   └─────────────────────────────┘│
│                                  │
│   === 40px ===                   │
└──────────────────────────────────┘
```

---

## 7. Responsive Design

### Breakpoints
```
Mobile:   < 640px  (single column)
Tablet:   640px - 1024px (1-2 columns)
Desktop:  > 1024px (2+ columns, but keep content max-width 800px)
```

### Mobile Adjustments
```
Padding: 20px (instead of 40px)
Font sizes: Same (16px body is readable on mobile)
Buttons: Full-width (easier to tap)
Cards: Stack vertically
Modals: Full-screen (if used)
```

### Desktop Enhancements
```
Padding: 40px
Hover effects: Subtle (border color change, shadow)
Cards: Side-by-side if 2+ columns
Max-width container: 800px (centered with 40px padding on each side)
```

---

## 8. Interaction Patterns

### No Animations (Keep It Static)
```
WRONG:
- Page transitions with fade-in
- Buttons with slide/rotate effects
- Progress bar with bouncing animation
- Confetti on completion
- Scroll-triggered animations
- Parallax effects

RIGHT:
- Instant page load
- Static progress bar (update every 3 sec)
- Subtle hover color change (instant)
- Focus states with outline
- Disabled states with opacity
```

### Focus & Hover
```
Button Hover:
  - Background color darkens
  - No animation (instant)

Input Focus:
  - Border becomes #E8956B (warm accent)
  - Subtle glow: box-shadow: 0 0 0 3px rgba(232, 149, 107, 0.1)
  - No animation (instant)

Link Hover:
  - Text color to warm accent
  - Underline appears (instant)
```

### Error States
```
Validation error:
  - Input border turns red (#EF4444)
  - Error message appears below (red text, small)
  - Focus moved to first errored field
  - No animation

Example:
┌─────────────────────────────┐
│ focusQuestions              │
│ [Dropdown ▼]                │ <- Red border
│ ✗ Please select 2 questions │ <- Red text, small
└─────────────────────────────┘
```

### Loading State
```
Progress bar visible
Text: "Your report is being analyzed..."
Estimated time shown
Status updates every 3 seconds (not animated)

If waiting > 20 sec:
  Show: "Still processing... your report should be ready in X minutes"
```

---

## 9. Accessibility

### Color Contrast
```
Text on background: 4.5:1 ratio minimum
Buttons: 3:1 ratio minimum
All colors tested with WCAG AA standard
```

### Semantic HTML
```
<button> for clickable elements (not <div>)
<label> for form fields
<h1>, <h2>, <h3> for headings (proper nesting)
<a> for links (not styled buttons)
Alt text for images (if any)
```

### Keyboard Navigation
```
Tab through form fields in order
Enter/Space to submit
Escape to close modals
Focus visible on all interactive elements
```

### Screen Readers
```
Form fields have <label>
Error messages associated with field (aria-invalid)
Loading state announced (aria-busy)
Progress updates announced (aria-live="polite")
```

---

## 10. CSS Architecture

### File Structure
```
/styles
  global.css
    - Reset, base styles
    - CSS variables for colors, spacing
    - Typography setup
  
  components.css
    - Button, input, card styles
    - Responsive utilities
  
  layout.css
    - Grid, container, spacing utilities
    - Responsive breakpoints
```

### CSS Variables (for maintainability)
```css
:root {
  /* Colors */
  --color-primary: #E8956B;
  --color-primary-hover: #D87F5B;
  --color-primary-active: #C86A4B;
  
  --color-bg-primary: #FAFAFA;
  --color-text-primary: #1F2937;
  --color-text-secondary: #6B7280;
  --color-border: #E5E7EB;
  --color-border-dark: #D1D5DB;
  
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  
  /* Spacing */
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 40px;
  
  /* Typography */
  --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-size-body: 16px;
  --font-size-small: 14px;
  --line-height: 1.6;
  
  /* Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
}
```

---

## 11. Visual Examples

### Color Usage in Context
```
Upload Page:
  H1 title: Dark charcoal (#1F2937)
  H2 "Select data type": Warm accent (#E8956B)
  Button: Warm accent background (#E8956B), white text
  Input border: Light (#E5E7EB), focus: Warm accent (#E8956B)

Processing Page:
  Progress bar: Warm accent (#E8956B)
  Progress %: Dark charcoal (#1F2937)
  Current phase: Secondary gray (#6B7280)

Completion Page:
  ✓ Checkmark: Warm accent (#E8956B)
  H1: Dark charcoal (#1F2937)
  Download button: Warm accent (#E8956B)
  "Past Reports" heading: Warm accent (#E8956B)
  Report card: White bg, light border (#E5E7EB)

Error State:
  Error text: Red (#EF4444)
  Border: Red (#EF4444)
  Other text: Dark charcoal (#1F2937)
```

---

## 12. Do's and Don'ts

### DO:
✓ Generous whitespace (let designs breathe)
✓ Clear, purposeful typography hierarchy
✓ Consistent button and input styling
✓ Clear focus states for accessibility
✓ Mobile-first approach
✓ Simple, readable forms
✓ Warm accent color for CTAs only (not overused)
✓ Subtle shadows and borders
✓ Professional, approachable tone
✓ Static, instant interactions

### DON'T:
✗ Gradients (flat colors only)
✗ Animations or transitions
✗ Multiple colors competing for attention
✗ Cluttered layouts or cramped spacing
✗ Decorative elements that distract
✗ Harsh contrasts (pure black text on white ok, but soften background)
✗ Rounded corners on everything (only buttons and cards, 6-8px)
✗ Drop shadows (keep subtle, almost invisible)
✗ Custom fonts (system fonts are faster, look modern)
✗ Complex component interactions
✗ Anything "trendy" (will age poorly)

---

## 13. Implementation Checklist

When building UI:
- [ ] All buttons use primary/secondary/tertiary styles
- [ ] All form inputs have proper focus states
- [ ] Color contrast meets WCAG AA
- [ ] Mobile responsive (test on 375px width)
- [ ] All interactive elements keyboard-accessible
- [ ] No animations or transitions
- [ ] Warm accent color used only for primary CTAs
- [ ] Whitespace matches spec (8px multiples)
- [ ] Typography follows type scale
- [ ] Error states tested (validation, payment, server errors)
- [ ] Loading states tested (progress bar, spinners removed)
- [ ] Screens tested on 3 breakpoints (mobile, tablet, desktop)

---

## 14. Design Tokens Summary

| Token | Value | Usage |
|-------|-------|-------|
| Primary Color | #E8956B | Buttons, focus, accent |
| Primary Hover | #D87F5B | Hover state |
| Primary Active | #C86A4B | Active/pressed state |
| Background | #FAFAFA | Page bg, off-white areas |
| Text Primary | #1F2937 | Main text, headings |
| Text Secondary | #6B7280| Secondary text, labels |
| Border Light | #E5E7EB | Subtle borders |
| Border Medium | #D1D5DB | Form inputs |
| Success | #10B981 | Confirmation, success |
| Warning | #F59E0B | Warnings, cautions |
| Error | #EF4444 | Errors, critical |
| Spacing Unit | 8px | All spacing (multiples of 8) |
| Border Radius | 6-8px | Buttons, inputs, cards |

---

## 15. Handoff to Developers

When sharing design system with developers:

1. **Provide CSS file** with all variables and base styles
2. **Document button component** (primary, secondary, tertiary examples)
3. **Document form inputs** (text, select, focus states)
4. **Provide layout grid** (max-width, padding, breakpoints)
5. **List typography** (sizes, weights, colors)
6. **Create component Figma** file (or Sketch) if needed
7. **Share this design system document** as reference
8. **Test in browser** before handing off (make sure colors render correctly)

---

## 16. References

- **Inspiration:** https://www.testgorilla.com/test-library/personality-culture-tests/16-personality-types-test/
- **Color Tool:** https://colorhexa.com/ (verify accent color #E8956B)
- **Accessibility:** WCAG 2.1 AA standard
- **Responsive Design:** Mobile-first, 800px max-content-width
- **Typography:** System fonts (platform-native, fast loading)

