import React from 'react'

// News — the blog's mobile face in the masthead (see NavCustomLink).
//
// Inspired by Material Symbols Outlined "news": a page with a folded top-right
// corner over three lines of text, the first one short. Redrawn rather than
// imported — Material's outlined icons are filled paths, and this family is
// stroked (fill:none, currentColor, 2px, round caps), so a dropped-in path
// would ignore the weight every other glyph in the bar is drawn to.
//
// The proportions are Material's, and they are load-bearing. Rendered at 18px a
// 2-unit stroke eats 1.5px from each side of a gap, so two lines whose centres
// are d units apart show only (d-2) units of daylight. An earlier draft shrank
// the page to 3.8-20.2 to leave a margin, which squeezed the line spacing to
// 3.6 units and fused the lower two lines together. At Material's spacing —
// page 3..21, lines at y=8/12/16 — every gap is 4 or 5 units, which holds.
//
// This is also why it renders at 18px rather than the 16px the megaphone it
// replaced used: that glyph was a large closed shape and read heavy, while this
// one is a thin outline with interior detail that needs the room.
export default function NewsIcon({ className, ...props }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* Page, with the top-right corner cut away. Top-left, bottom-left and
          bottom-right are rounded to r=2; the two corners of the fold stay
          sharp, so the cut still reads as a crease rather than a soft edge. */}
      <path d="M5 3 H16 L21 8 V19 A2 2 0 0 1 19 21 H5 A2 2 0 0 1 3 19 V5 A2 2 0 0 1 5 3 Z" />
      {/* the fold itself */}
      <path d="M16 3 V8 H21" />
      {/* headline, sitting beside the fold, then two full-width lines */}
      <path d="M7 8 H12" />
      <path d="M7 12 H17" />
      <path d="M7 16 H17" />
    </svg>
  )
}
