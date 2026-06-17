# LendSafe AI - Frontend React Application

This is the client-side single page application (SPA) for LendSafe AI, built with **React** and **Vite**.

---

## Features

1. **Dark Glassmorphism Interface**: Responsive three-column layout featuring frosted-glass elements, high contrast typography, and custom micro-animations.
2. **Interactive Selection & Upload**: Allows seamless swapping between predefined realistic mock profiles or uploading custom documents/raw text.
3. **Real-time Extraction Auditing**: Visualizes extraction results side-by-side with OCR confidence percentages, highlighting evidence text quotes.
4. **Programmatic Audit Status**: Highlights decision flags (`Approve`, `Manual Review`, `Reject`) with clean visual status tags.
5. **Interactive Audit Chatbot**: A side panel chat widget where analysts can query the bot for document details.
6. **Simulated Role Isolation**: Switch between tenant profiles in the header to hot-swap session states.

---

## Architecture & Layout

* **`src/App.jsx`**: Main application component, managing the local reactive states, API call bindings, global loader/banners, and sub-panels:
  * **Header**: Contains tenant identity dropdown and reset controls.
  * **Document Selection (Column 1)**: Form controls for preloaded mock files, plain text inputs, or file uploads.
  * **Extraction & Underwriting (Column 2)**: Visual status rules dashboard and structured JSON fields viewer.
  * **Chat Auditing (Column 3)**: Chat conversation log and prompt suggestion chips.
* **`src/index.css`**: Core styling system. Declares CSS variables, scrollbars, keyframe animations, glass borders, and responsive grid breakpoint rules.

---

## Styling & Theme

* Built purely using **Vanilla CSS** for performance and style control.
* Utilizes a dark-mode theme built around HSL color palettes:
  * Glass backdrop filters (`backdrop-filter: blur(16px)`).
  * High-contrast accessibility text levels (conforming to WCAG AA/AAA guidelines).
  * Highlight states for success green, warning orange, and danger red.

---

## Accessibility (a11y) Implementation

The UI incorporates accessibility structures:
* **Interactive Roles**: Proper `role="button"`, `role="tab"`, and `role="alert"` specifications.
* **ARIA Labels**: `aria-label`, `aria-live`, and description attributes on inputs, drop-zones, and headers.
* **Keyboard Navigation**: Correct `tabIndex` sequences allowing screen reader users to tab through select controls, upload buttons, chat inputs, and action buttons using only keyboard controls.
* **Accessible Contrasts**: Harmonious borders and backgrounds ensuring readable text elements under standard light/dark modes.

---

## Installation & Development Run

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Typically launches on `http://localhost:5173`.
