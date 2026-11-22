import { findAll, findOne, hasMousePointer } from './dom.js';

/*
 * With a mouse, hovering a project card plays its preview clip inside the card. Only one preview
 * plays at a time, and a short delay stops a sweep of the mouse across the grid from starting several.
 */
let playingPreview = null;

function stopPreview(video) {
  video.pause();
  video.closest('.frame')?.classList.remove('is-playing');
  if (playingPreview === video) playingPreview = null;
}

export function setUpProjectCardPreviews(root = document) {
  if (!hasMousePointer()) return;
  findAll('.card[data-preview]', root).forEach((card) => {
    const previewSource = card.dataset.preview;
    const video = findOne('video', card);
    const frame = findOne('.frame', card);
    if (!previewSource || !video) return;

    // a preview with a start point loops back to that point, not to the beginning
    const startTime = Number(previewSource.split('#t=')[1] || 0);
    if (startTime > 0) {
      video.loop = false;
      video.addEventListener('ended', () => {
        video.currentTime = startTime;
        video.play().catch(() => {});
      });
    }

    let hoverDelay;
    card.addEventListener('mouseenter', () => {
      hoverDelay = setTimeout(() => {
        if (playingPreview && playingPreview !== video) stopPreview(playingPreview);
        if (!video.src) video.src = previewSource;
        playingPreview = video;
        video.addEventListener(
          'playing',
          () => {
            if (playingPreview === video) frame.classList.add('is-playing');
          },
          { once: true },
        );
        video.play().catch(() => {});
      }, 180);
    });
    card.addEventListener('mouseleave', () => {
      clearTimeout(hoverDelay);
      stopPreview(video);
    });
  });
}
