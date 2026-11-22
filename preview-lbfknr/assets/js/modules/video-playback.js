import { findAll } from './dom.js';

/*
 * Videos written into the page get the muted *attribute* but not always the muted *property*,
 * and phones refuse to autoplay a video that isn't muted. Set both explicitly.
 */
export function prepareVideosForAutoplay(root = document) {
  findAll('video', root).forEach((video) => {
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
  });
}

/*
 * Starts a muted video. If the phone still blocks it (e.g. in Low Power Mode), it starts on the
 * visitor's first touch or click instead.
 */
export function playWhenAllowed(video) {
  const playing = video.play();
  if (!playing || !playing.catch) return;
  playing.catch(() => {
    const playOnFirstInteraction = () => {
      video.play().catch(() => {});
      removeEventListener('touchstart', playOnFirstInteraction);
      removeEventListener('click', playOnFirstInteraction);
    };
    addEventListener('touchstart', playOnFirstInteraction, { once: true, passive: true });
    addEventListener('click', playOnFirstInteraction, { once: true });
  });
}
