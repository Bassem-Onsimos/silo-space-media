import { findAll, findOne } from './dom.js';

/* Project pages: a video plays, with sound, when its round play button is pressed; any other playing video pauses. */
export function setUpVideoPlayers() {
  findAll('.player button.play-button').forEach((playButton) =>
    playButton.addEventListener('click', () => {
      const player = playButton.closest('.player');
      const video = findOne('video', player);
      findAll('.player video').forEach((otherVideo) => {
        if (otherVideo !== video) otherVideo.pause();
      });
      player.classList.add('is-started');
      video.controls = true;
      video.muted = false;
      video.play().catch(() => {});
    }),
  );
}
