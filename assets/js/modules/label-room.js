import { findAll } from './dom.js';

/*
 * Room above a small label that hangs above a heading at the top of a section (see styles/alignment.css).
 * The CSS keeps the label's full height free above the row (--label-hang), which is exact when the label is the
 * highest thing in it. In a side-by-side row, though, a taller column beside the heading may already reach above the
 * label, and then that room would only add empty space. So this measures each row and keeps just what is needed:
 * nothing when the label fits beside the other column, the label's full height when it is the highest thing,
 * anything in between when it sticks out partly. The gap above the section's content then always matches the bottom.
 */
/* the same rows as the rule in styles/alignment.css */
const ROWS_WITH_HANGING_LABEL =
  ':is(.wrap, .wrap > :first-child):is(.split, .intro-grid, .contact-grid, .section-heading)' +
  ':not(.contact-page *):has(> div:first-child > .label:first-child)';

function keepRoomForLabel(row) {
  const label = row.querySelector(':scope > div:first-child > .label:first-child');
  if (getComputedStyle(label).position !== 'absolute') {
    row.style.removeProperty('--label-room');
    return;
  }
  // layout positions (offsetTop), which ignore the entrance animations' transforms
  const column = label.parentElement;
  const columnTop = column.offsetParent === row ? column.offsetTop : column.offsetTop - row.offsetTop;
  const labelTop = columnTop + label.offsetTop - row.clientTop; // from the top of the row's padding
  const roomNow = parseFloat(getComputedStyle(row).paddingTop) || 0;
  // how far the label would reach above the row's content without any room: that much room is needed
  const roomNeeded = Math.max(0, Math.ceil(roomNow - labelTop));
  if (Math.abs(roomNeeded - roomNow) >= 1) row.style.setProperty('--label-room', `${roomNeeded}px`);
}

export function setUpLabelRoom() {
  if (!('ResizeObserver' in window)) return; // the CSS room alone is used
  const rows = findAll(ROWS_WITH_HANGING_LABEL);
  if (!rows.length) return;
  // re-measured whenever a row or either column changes size: window resizes, fonts loading, headings being fitted
  const observer = new ResizeObserver((entries) => {
    new Set(entries.map((entry) => entry.target.closest(ROWS_WITH_HANGING_LABEL))).forEach(keepRoomForLabel);
  });
  rows.forEach((row) => {
    keepRoomForLabel(row);
    [...row.children].forEach((column) => observer.observe(column));
  });
}
