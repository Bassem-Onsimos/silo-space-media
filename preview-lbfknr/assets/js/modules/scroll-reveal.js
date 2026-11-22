import { findAll, findOne, prefersReducedMotion } from './dom.js';

/*
 * Blocks fade and slide up as they scroll into view. Lists (cards, photos, numbers…) reveal item by
 * item with a short stagger. Waiting elements get the class reveal-pending (or reveal-fade-pending: fade only, no slide); the
 * motion itself is a Web Animation, which runs on the GPU and leaves nothing behind when it ends.
 */

/* Containers whose children reveal one by one rather than all at once. */
const STAGGERED_CONTAINERS =
  '.feat,.grid,.services-grid,.gallery,.vertical-videos,.stats,.stats-band,.photo-strip,.values,.split,.intro-grid,.intro-side,.feature-split,.quote,.contact-grid,.meta-row,.pills,#project-list,.quote>div,.contact-grid>div:first-child,.contact-options,.video-block,.about-hero-copy,.about-actions';
/* Never split these: each is one visual unit. */
const SINGLE_UNITS =
  '.card,.service-card,.player,.frame,.form,.partner-tile,img,video,picture,blockquote,h1,h2,h3,p,a,button,ul,ol';
/* Page backgrounds that fade in with the hero text, like the portrait on the About page. */
const HERO_BACKGROUNDS = [
  '#home-hero > .hero-video',
  '#projects-hero > .reel-video.is-active',
  '#podcasts-hero > picture > img',
  '.project-hero > picture > img',
  '.podcast-hero > picture > img',
].join(',');
export const REVEAL_EASING = 'cubic-bezier(.2,.7,.1,1)';
/* An item reveals once it is this far above the bottom edge of the screen. */
const REVEAL_MARGIN = '0px 0px -8% 0px';

/* Plays the entrance of one waiting element: a fade, plus a short rise unless it only fades. */
function playEntrance(element, staggerIndex) {
  const fadeOnly = element.classList.contains('reveal-fade-pending');
  // fade to the element's own resting opacity: hero photos are dimmed on purpose (e.g. 0.78), and
  // fading them to 1 would show them too bright until the animation ends and they snap back.
  // Its own CSS transition is paused while reading, or the reading would be its start value (e.g. the
  // Projects reel video, which would then fade from 0 to 0 and pop in at the end).
  const inlineTransition = element.style.transition;
  element.style.transition = 'none';
  element.classList.remove('reveal-pending', 'reveal-fade-pending');
  const restingOpacity = getComputedStyle(element).opacity;
  element.style.transition = inlineTransition;
  element.animate(
    fadeOnly
      ? [{ opacity: 0 }, { opacity: restingOpacity }]
      : [
          { opacity: 0, transform: 'translateY(18px)' },
          { opacity: restingOpacity, transform: 'translateY(0)' },
        ],
    { duration: 700, delay: staggerIndex * 80, easing: REVEAL_EASING, fill: 'backwards' },
  );
}

/*
 * The reveal margin keeps items waiting until they are a little above the bottom edge of the screen,
 * so they rise in as you scroll. Two cases need to skip that wait:
 *   - when a page opens, anything already on screen (e.g. the bottom row of a hero) reveals at once;
 *   - at the very end of the page, the last items can never get above the margin because the page
 *     can't scroll further (also after a refresh, when the browser reopens the page where you left it).
 */
const waitingToReveal = new Map(); // element -> { observer, staggerIndex }

function revealWaitingItemsOnScreen() {
  waitingToReveal.forEach(({ observer, staggerIndex }, element) => {
    const box = element.getBoundingClientRect();
    if (box.top >= innerHeight || box.bottom <= 0) return;
    waitingToReveal.delete(element);
    observer.unobserve(element);
    playEntrance(element, staggerIndex);
  });
}

function revealWhatIsLeftAtPageEnd() {
  // a little slack: phone browsers report the screen height with their toolbars in different ways
  const atPageEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 24;
  if (atPageEnd) revealWaitingItemsOnScreen();
}
addEventListener('scroll', revealWhatIsLeftAtPageEnd, { passive: true });
addEventListener('resize', revealWhatIsLeftAtPageEnd);
// after a refresh the browser may restore the scroll position late, and without a scroll event
addEventListener('load', () => [0, 300, 1000].forEach((delay) => setTimeout(revealWhatIsLeftAtPageEnd, delay)));

/* Watches elements and plays each one's entrance as it scrolls into view. */
function revealOnScroll(elements, staggerIndexOf, rootMargin) {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        waitingToReveal.delete(entry.target);
        playEntrance(entry.target, staggerIndexOf(entry.target));
      }),
    { threshold: 0, rootMargin },
  );
  elements.forEach((element) => {
    waitingToReveal.set(element, { observer, staggerIndex: staggerIndexOf(element) });
    observer.observe(element);
  });
  revealWaitingItemsOnScreen();
}

export function setUpScrollReveal() {
  if (!('IntersectionObserver' in window) || !Element.prototype.animate || prefersReducedMotion()) return;
  const main = findOne('#main');
  const staggerSlot = new Map();

  const markForReveal = (element, index, className = 'reveal-pending') => {
    if (element.parentElement.closest('.reveal-pending,.reveal-fade-pending,.partners')) return;
    element.classList.add(className);
    staggerSlot.set(element, index % 4);
  };
  // A block taller than most of the screen would be half-revealed before you reach its end, so reveal its parts instead.
  const isTallBlock = (element) =>
    element.children.length > 1 && !element.matches(SINGLE_UNITS) && element.offsetHeight > innerHeight * 0.8;
  const walk = (element, index) => {
    if (element.matches('[data-no-reveal]')) return; // filled in later; its items reveal themselves
    if (element.matches('.about-portrait')) {
      markForReveal(element, index, 'reveal-fade-pending');
      return;
    } // pinned to the corner: fade in place, no slide
    if (element.matches('.service-card')) {
      // fade the card face: fading the 3D card forces a full redraw
      const front = element.querySelector('.service-card-front');
      if (front) markForReveal(front, index, 'reveal-fade-pending');
      return;
    }
    if (element.matches(STAGGERED_CONTAINERS) || isTallBlock(element))
      [...element.children].forEach((child, childIndex) => walk(child, childIndex));
    else markForReveal(element, index);
  };
  findAll('section:not(.partners) .wrap, .next .wrap', main).forEach((wrap) =>
    [...wrap.children].forEach((child, index) => walk(child, index)),
  );
  findAll(HERO_BACKGROUNDS, main).forEach((background) => markForReveal(background, 0, 'reveal-fade-pending'));
  const footerContent = findOne('.site-footer .wrap');
  if (footerContent) markForReveal(footerContent, 0);

  // Start once the page has painted and settled: the first frames are busy (starting video, decoding
  // images), and a fade begun then stalls and snaps to its end. Pages that open on a playing video
  // (Home, Projects) are busiest until that video is running, so wait for it (at most 0.8 s).
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    revealOnScroll([...staggerSlot.keys()], (element) => staggerSlot.get(element) || 0, REVEAL_MARGIN);
  };
  const openingVideo = main.querySelector('video[autoplay]');
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (openingVideo && openingVideo.readyState < 3) {
        openingVideo.addEventListener('playing', () => requestAnimationFrame(() => setTimeout(start, 60)), {
          once: true,
        });
        setTimeout(start, 800);
      } else {
        setTimeout(start, 120);
      }
    }),
  );
}

/* Items added after the page loaded (e.g. the podcast episode cards) get the same entrance. */
export function revealAddedItems(elements) {
  if (!('IntersectionObserver' in window) || !Element.prototype.animate || prefersReducedMotion()) return;
  elements.forEach((element) => element.classList.add('reveal-pending'));
  revealOnScroll(elements, (element) => elements.indexOf(element) % 3, '0px 0px -6% 0px');
}
