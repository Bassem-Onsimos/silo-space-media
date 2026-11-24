import { findAll } from './dom.js';

/*
 * The contact banner's still background is a layer fixed to the whole screen, shown only through the banner (see
 * styles/contact-banner.css). Safari on iPhone colours its see-through toolbar from a dark element fixed to the bottom of
 * the screen, cut-out or not, and kept the toolbar dark everywhere once the banner had been on screen. So the layer is
 * hidden while the banner is out of view. A margin a little larger than the toolbar shows it just before the banner
 * scrolls in, so it is never seen missing.
 */
export function setUpContactBanner() {
  const banners = findAll('.contact-banner');
  if (!banners.length || !('IntersectionObserver' in window)) return; // the layer then simply stays visible
  const observer = new IntersectionObserver(
    (entries) => entries.forEach((entry) => entry.target.classList.toggle('is-off-screen', !entry.isIntersecting)),
    { rootMargin: '120px 0px' },
  );
  banners.forEach((banner) => observer.observe(banner));
}
