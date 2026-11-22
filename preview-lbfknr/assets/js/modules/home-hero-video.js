import { findOne } from './dom.js';
import { playWhenAllowed } from './video-playback.js';

/* Home page: the background video only plays while it is on screen and the tab is visible. */
export function setUpHomeHeroVideo() {
  const video = findOne('#home-hero .hero-video');
  if (!video) return;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !document.hidden) playWhenAllowed(video);
      else video.pause();
    },
    { threshold: 0.1 },
  );
  observer.observe(video);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else playWhenAllowed(video);
  });
}
