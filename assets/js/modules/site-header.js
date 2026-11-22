import { findOne } from './dom.js';

/*
 * The header is transparent over a page's hero image and turns solid black once the page scrolls.
 * Pages without a hero (Contact) keep it solid. On phones, the menu button opens the full-screen menu.
 */
export function setUpSiteHeader() {
  const header = findOne('#site-header');
  const menuButton = findOne('#menu-button');
  const mobileMenu = findOne('#mobile-menu');
  const pageHasHero = Boolean(findOne('.hero, .project-hero, .about-hero, .podcast-hero'));

  let isSolid = null;
  let pendingFrame = 0;
  const updateHeader = () => {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      const shouldBeSolid = window.scrollY > 40 || !pageHasHero;
      if (shouldBeSolid !== isSolid) {
        isSolid = shouldBeSolid;
        header.classList.toggle('is-solid', shouldBeSolid);
      }
    });
  };
  addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  menuButton.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-is-open');
    menuButton.setAttribute('aria-expanded', isOpen);
    mobileMenu.setAttribute('aria-hidden', !isOpen);
  });
}
