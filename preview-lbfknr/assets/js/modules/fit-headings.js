import { findAll } from './dom.js';

/*
 * Big headings: when one long word (e.g. SPOTLIGHTING) is wider than its column, step the font size
 * down until it fits, so it never runs into the content beside it. Runs again when the window resizes.
 */
function fitHeadings() {
  findAll('h1.display, h2.display, .about-hero h1').forEach((heading) => {
    heading.style.fontSize = '';
    if (!heading.clientWidth) return;
    let fontSize = parseFloat(getComputedStyle(heading).fontSize);
    let steps = 0;
    while (heading.scrollWidth > heading.clientWidth + 1 && fontSize > 22 && steps++ < 70) {
      fontSize -= 2;
      heading.style.fontSize = `${fontSize}px`;
    }
  });
}

export function setUpHeadingFitting() {
  fitHeadings();
  if (document.fonts) document.fonts.ready.then(fitHeadings);
  return fitHeadings;
}
