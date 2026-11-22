/* Small helpers shared by the other modules. */

export const findOne = (selector, root = document) => root.querySelector(selector);
export const findAll = (selector, root = document) => [...root.querySelectorAll(selector)];

/* True on laptops and desktops with a mouse or trackpad (not on touch screens). */
export const hasMousePointer = () => matchMedia('(hover:hover) and (pointer:fine)').matches;

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* iPhone, iPad and desktop Safari, which get their own video files (see projects-reel.js). */
export const isAppleSafari = (() => {
  const userAgent = navigator.userAgent;
  const isIOS = /iP(hone|ad|od)/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isDesktopSafari = /Safari/.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(userAgent);
  return isIOS || isDesktopSafari;
})();
