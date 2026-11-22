import { findOne } from './dom.js';

/*
 * The running camera timecode (hours:minutes:seconds:frames, 24 frames a second) on the Projects
 * and Podcasts heroes. It pauses while the hero is off screen and carries on from where it stopped.
 */
let interval = null;
let startedAt = 0;
let secondsBeforePause = 0;

const twoDigits = (number) => String(Math.floor(number)).padStart(2, '0');

export function startTimecode() {
  const display = findOne('#timecode');
  if (!display || interval) return;
  startedAt = performance.now();
  interval = setInterval(() => {
    const seconds = secondsBeforePause + (performance.now() - startedAt) / 1000;
    display.textContent = `${twoDigits(seconds / 3600)}:${twoDigits((seconds / 60) % 60)}:${twoDigits(
      seconds % 60,
    )}:${twoDigits((seconds * 24) % 24)}`;
  }, 125);
}

export function pauseTimecode() {
  if (!interval) return;
  clearInterval(interval);
  interval = null;
  secondsBeforePause += (performance.now() - startedAt) / 1000;
}
