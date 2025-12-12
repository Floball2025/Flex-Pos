# Design Guidelines: Loyalty Points Accumulation App

## Design Approach

**Selected Approach:** Design System - Material Design 3
**Justification:** This is a utility-focused business application requiring clarity, efficiency, and reliability. Material Design 3 provides excellent patterns for transactional workflows, form handling, status feedback, and mobile-optimized scanning interfaces.

**Core Principles:**
- Operational clarity over visual flair
- Task-focused workflow optimization
- Clear visual hierarchy for status communication
- Touch-friendly targets for mobile/tablet use
- Minimal cognitive load during transactions

---

## Typography System

**Font Family:** Roboto (Google Fonts)
- Primary: Roboto Regular (400)
- Emphasis: Roboto Medium (500)
- Headers: Roboto Bold (700)

**Type Scale:**
- Display (Transaction Success/Error): text-4xl (36px), font-bold
- H1 (Screen Titles): text-2xl (24px), font-bold
- H2 (Section Headers): text-xl (20px), font-medium
- Body (Labels, Instructions): text-base (16px), font-normal
- Small (Helper Text, Timestamps): text-sm (14px), font-normal
- Micro (Status Badges): text-xs (12px), font-medium, uppercase, tracking-wide

**Line Heights:**
- Headings: leading-tight (1.25)
- Body: leading-normal (1.5)
- Form labels: leading-relaxed (1.625)

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16
- Micro spacing (form elements): space-y-2, gap-2
- Component spacing: space-y-4, p-4
- Section spacing: space-y-8, py-8
- Screen padding: p-6 (mobile), p-8 (tablet+)

**Grid System:**
- Configuration Screen: Single column, max-w-md centered
- Main Transaction Screen: Full width with strategic sections
- Success/Error Modals: max-w-sm centered

**Container Structure:**
```
Screen Container: min-h-screen, p-6
Content Area: max-w-2xl mx-auto (for forms)
Full-width Sections: w-full (for scan preview, status displays)
```

---

## Component Library

### 1. Navigation & Screen Structure

**Top App Bar:**
- Height: h-16
- Contains: Screen title (text-xl font-bold), settings icon (right)
- Spacing: px-6, flex justify-between items-center
- Border: border-b with subtle divider

**Screen Layouts:**
- Configuration Screen: Vertical form layout, single column
- Main Screen: Stacked sections (scan area, manual entry, action buttons)
- Success/Failure Overlay: Full-screen modal with centered content

### 2. Forms & Inputs

**Input Fields:**
- Height: h-12
- Padding: px-4
- Border: border-2, rounded-lg
- Focus state: ring-2 offset-2
- Label position: Above input, mb-2, text-sm font-medium
- Helper text: mt-1, text-xs

**Input Group Structure:**
```
Container: space-y-6
Label: text-sm font-medium mb-2
Input: h-12 rounded-lg border-2 px-4
Helper: text-xs mt-1
Error: text-xs mt-1 (validation errors)
```

**Form Sections:**
- Configuration fields: 4 inputs (host, aid_pass, acquirerID, terminalID)
- Manual entry: Radio selection + conditional input
- Each section: space-y-4, pb-6, border-b (except last)

### 3. Buttons

**Primary Action (Process Transaction):**
- Size: h-14, px-8
- Typography: text-base font-medium
- Radius: rounded-xl
- Full width on mobile: w-full sm:w-auto

**Secondary Action (Cancel, Edit):**
- Size: h-12, px-6
- Typography: text-sm font-medium
- Radius: rounded-lg
- Outline variant with border-2

**Icon Buttons (Settings, Close):**
- Size: h-10 w-10
- Padding: p-2
- Radius: rounded-full

### 4. QR Code Scanner Interface

**Scanner Area:**
- Aspect ratio: aspect-square or aspect-video
- Max width: max-w-md mx-auto
- Border: Scanning frame with corner guides
- Spacing: my-8

**Scanner Frame:**
- Corners: 4 corner brackets (L-shaped borders)
- Each corner: w-12 h-12, border-4 on 2 sides
- Position: absolute positioning in relative container
- Animation: Optional subtle pulse during active scan

**Scanner Controls:**
- Below scanner: flex gap-4 justify-center mt-4
- Toggle camera button: h-12 w-12 rounded-full
- Torch/flash button: h-12 w-12 rounded-full

### 5. Manual Entry Section

**Input Method Selector:**
- Radio button group: flex gap-6
- Options: "QR Code" | "Customer ID" | "Phone Number"
- Radio visual: h-5 w-5, custom styled
- Label: ml-2, text-base

**Conditional Input:**
- Shows based on selection
- Input with prefix display: Flex container with prefix badge
- Prefix badges: "0e+sh1" or "0f+sh1" in rounded pill
- Spacing: mt-4

### 6. Status & Feedback

**Transaction Status Display:**
- Container: rounded-2xl, p-8, text-center
- Icon: h-16 w-16 mx-auto mb-4
- Status text: text-2xl font-bold mb-2
- Details: text-base space-y-1

**Success State:**
- Large checkmark icon (heroicons check-circle)
- Display: RRN, Bonus points, Balance
- Layout: space-y-3

**Error State:**
- Large X icon (heroicons x-circle)
- Error message
- Retry action button below

**Loading State:**
- Spinner: h-12 w-12 mx-auto
- Text: "Processing transaction..." below
- Container: p-12

**Transaction Details Card:**
- Border: border rounded-xl
- Padding: p-4
- Key-value pairs: flex justify-between, space-y-2
- Labels: text-sm
- Values: text-base font-medium

### 7. Configuration Screen

**Layout:**
- Centered form: max-w-md mx-auto
- Header: mb-8 with title and subtitle
- Form: space-y-6
- Actions: sticky bottom bar or mt-8

**Input Pattern:**
- 4 stacked inputs with labels
- Each input group: mb-6
- Save button: Full width, h-14, at bottom
- Back/Cancel: Top-left icon button in header

**Validation:**
- Required field indicator: Asterisk in label
- Error messages: Below input, text-xs
- Success save: Toast notification or temporary banner

### 8. Data Display

**Transaction Summary:**
- Card layout: border rounded-xl p-6
- Header: flex justify-between items-center mb-4
- Timestamp: text-xs
- Amount: text-2xl font-bold
- Product details: text-sm space-y-1

**Balance Display:**
- Prominent placement after success
- Large number: text-3xl font-bold
- Label: text-sm above number
- Optional icon: coins or points badge

---

## Icons

**Library:** Heroicons (via CDN)
**Icons Required:**
- cog-6-tooth (Settings)
- qrcode (Scanner)
- device-phone-mobile (Phone entry)
- identification (ID entry)
- check-circle (Success)
- x-circle (Error)
- arrow-path (Loading/Retry)
- camera (Camera toggle)
- bolt (Flash/Torch)
- x-mark (Close)

**Icon Sizing:**
- Navigation: h-6 w-6
- Status displays: h-16 w-16
- Inline with text: h-5 w-5

---

## Screen Flow Architecture

**1. Main Transaction Screen (Default View):**
- Top: App bar with title "Loyalty Points" + settings icon
- Section 1: QR Scanner (collapsible or always visible)
- Section 2: Manual entry toggle with conditional input
- Section 3: Process transaction button (disabled until valid input)
- Bottom: Last transaction summary (if exists)

**2. Configuration Screen:**
- Top: Back button + "Settings" title
- Form with 4 inputs vertically stacked
- Save button at bottom
- Validation feedback inline

**3. Transaction Processing Overlay:**
- Full-screen semi-transparent backdrop
- Centered card with loading state
- Non-dismissible during processing

**4. Result Screen (Success/Error):**
- Full-screen modal
- Close button top-right
- Icon + message centered
- Transaction details below
- Action buttons at bottom (New Transaction, View Details)

---

## Accessibility Standards

**Touch Targets:**
- Minimum: 44x44px (h-11 w-11 minimum)
- Primary buttons: h-14
- Icon buttons: h-10 w-10 minimum

**Form Accessibility:**
- All inputs: Proper label association
- aria-label for icon buttons
- aria-live regions for status updates
- Error announcements

**Keyboard Navigation:**
- Tab order: Logical flow through form
- Enter key: Submit forms
- Escape: Close modals

**Focus Indicators:**
- ring-2 ring-offset-2 on all interactive elements
- Never remove outline without replacement

---

## Responsive Behavior

**Mobile (base):**
- Single column layouts
- Full-width buttons
- Scanner: 90vw max
- Padding: p-4 to p-6

**Tablet (md: 768px+):**
- Configuration: max-w-md centered
- Padding: p-6 to p-8
- Button groups: Inline instead of stacked

**Desktop (lg: 1024px+):**
- Main screen: max-w-2xl centered
- Multi-column only for transaction history (if implemented)
- Scanner: Fixed max-w-md

---

## Animation Guidelines

**Use Sparingly:**
- Modal enter/exit: Fade + slide (duration-200)
- Success state: Icon scale animation (scale-in)
- Loading spinner: Rotate animation
- No animations on scanner frame (static guides only)
- No transitions on form inputs (instant feedback)

---

## Images

No decorative images required. This is a functional business application focused on efficiency. The QR scanner provides the primary visual element through camera preview.