import { findAll, findOne } from './dom.js';

/* Home page: the partner logos fade in one after another as the section scrolls into view. */
export function setUpPartnersReveal() {
  const section = findOne('#partners');
  if (!section || !('IntersectionObserver' in window)) return;
  section.classList.add('partners-fade');
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }),
    { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
  );
  findAll('.partner-tile', section).forEach((tile) => observer.observe(tile));
}
