import { findAll, findOne, isAppleSafari, prefersReducedMotion } from './dom.js';
import { playWhenAllowed } from './video-playback.js';
import { pauseTimecode, startTimecode } from './timecode.js';

/*
 * Projects page hero: a clip from each project plays in turn, with a progress bar per clip and a
 * "Now showing" link to that project.
 *
 * Each clip has its own <video>, stacked; switching is a play() plus an opacity crossfade on a video
 * that is already loaded and parked at its start time, so there is no loading pause between clips.
 * Only the visible clip plays; the next one is prepared in the background. The reel only runs while
 * the hero is on screen and the tab is visible.
 *
 * Which file plays:
 *   - most browsers: the clip in src (data from site/_data/projectsReel.js)
 *   - Safari in landscape: data-safari-video
 *   - Safari / iPhone held upright: data-portrait-video, a short clip already cropped to portrait
 */
const CLIP_DURATION_MS = 6500;

export function setUpProjectsReel() {
  const hero = findOne('#projects-hero');
  const videos = findAll('#projects-hero .reel-video');
  if (!hero || !videos.length) return;
  const progressBars = findAll('#reel-progress button');
  const nowShowingLink = findOne('#reel-now-showing');
  const reduceMotion = prefersReducedMotion();
  const usePortraitClips = isAppleSafari && innerHeight > innerWidth;

  const clipSource = (index) => {
    const data = videos[index].dataset;
    if (usePortraitClips) return data.portraitVideo;
    return isAppleSafari ? data.safariVideo : null; // null: keep the src from the page
  };
  const clipStartTime = (index) =>
    Number(usePortraitClips ? videos[index].dataset.portraitStartTime : videos[index].dataset.startTime);

  /* Loads a clip ahead of its turn and parks it at its start time, so switching to it never waits. */
  const prepareClip = (index) => {
    const video = videos[index];
    const source = clipSource(index);
    if (source && video.dataset.preparedSource !== source) {
      video.dataset.preparedSource = source;
      video.src = source;
    }
    if (video.preload !== 'auto') {
      video.preload = 'auto';
      video.load();
    }
    const seekToStart = () => {
      if (video.paused) {
        try {
          video.currentTime = clipStartTime(index);
        } catch (error) {
          /* not seekable yet */
        }
      }
    };
    if (video.readyState >= 1) seekToStart();
    else video.addEventListener('loadedmetadata', seekToStart, { once: true });
  };

  let currentIndex = 0;
  let isRunning = false;
  let switchTimer = null;
  let progressFrame = 0;

  const showClip = (index) => {
    clearTimeout(switchTimer);
    cancelAnimationFrame(progressFrame);
    const previousVideo = videos[currentIndex];
    const video = videos[index];
    currentIndex = index;

    progressBars.forEach((bar, barIndex) => {
      bar.classList.remove('is-active');
      bar.classList.toggle('is-done', barIndex < index);
      bar.style.removeProperty('--clip-progress');
    });
    progressBars[index].classList.add('is-active');
    nowShowingLink.href = video.dataset.projectUrl;
    nowShowingLink.textContent = `${video.dataset.projectName} →`;

    const clipWindow = CLIP_DURATION_MS / 1000;
    const startTime = clipStartTime(index);
    if (video.readyState < 1 || Math.abs(video.currentTime - startTime) > clipWindow + 0.5) prepareClip(index);
    const nextIndex = (index + 1) % videos.length;

    // The clip's own playback position is the clock: the bar fills with it and pauses whenever it pauses.
    let reachedStart = false; // ignore the position until the clip has actually reached its start point
    const trackProgress = () => {
      if (currentIndex !== index || !isRunning) return;
      if (!reachedStart) {
        if (
          video.readyState >= 2 &&
          !video.seeking &&
          video.currentTime >= startTime - 0.1 &&
          video.currentTime < startTime + clipWindow
        )
          reachedStart = true;
        else {
          progressFrame = requestAnimationFrame(trackProgress);
          return;
        }
      }
      const progress = Math.max(0, Math.min(1, (video.currentTime - startTime) / clipWindow));
      progressBars[index].style.setProperty('--clip-progress', progress.toFixed(4));
      if (!reduceMotion && (progress >= 1 || video.ended || video.currentTime < startTime - 0.5)) {
        moveToNextClip();
        return;
      }
      progressFrame = requestAnimationFrame(trackProgress);
    };

    // Switch once the next clip can play; until then hold this clip on its last frame so bar and picture agree.
    const moveToNextClip = () => {
      progressBars[index].style.setProperty('--clip-progress', '1');
      let attempts = 0;
      const trySwitching = () => {
        if (currentIndex !== index || !isRunning) return;
        if (videos[nextIndex].readyState >= 3 || attempts++ >= 16) showClip(nextIndex);
        else {
          if (!video.paused) video.pause();
          switchTimer = setTimeout(trySwitching, 250);
        }
      };
      trySwitching();
    };

    playWhenAllowed(video);
    progressFrame = requestAnimationFrame(trackProgress);
    video.classList.add('is-active');
    if (previousVideo !== video) {
      previousVideo.classList.remove('is-active');
      setTimeout(() => {
        if (!previousVideo.classList.contains('is-active')) previousVideo.pause();
      }, 700);
    }
    prepareClip(nextIndex);
  };

  progressBars.forEach((bar, index) =>
    bar.addEventListener('click', () => {
      if (index !== currentIndex) {
        prepareClip(index);
        showClip(index);
      }
    }),
  );

  const setRunning = (shouldRun) => {
    if (shouldRun === isRunning) return;
    isRunning = shouldRun;
    hero.classList.toggle('is-paused', !shouldRun);
    if (shouldRun) {
      showClip(currentIndex);
      startTimecode();
    } else {
      clearTimeout(switchTimer);
      cancelAnimationFrame(progressFrame);
      videos.forEach((video) => video.pause());
      pauseTimecode();
    }
  };

  prepareClip(0);
  new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting && !document.hidden), {
    threshold: 0.15,
  }).observe(hero);
  document.addEventListener('visibilitychange', () =>
    setRunning(!document.hidden && hero.getBoundingClientRect().bottom > 0),
  );
}
