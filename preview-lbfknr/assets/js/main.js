/*
 * Starts the site's behaviour on every page. Each feature looks for its own elements and does
 * nothing on pages that don't have them, so one script serves the whole site.
 */
import { setUpSiteHeader } from './modules/site-header.js';
import { prepareVideosForAutoplay } from './modules/video-playback.js';
import { setUpHomeHeroVideo } from './modules/home-hero-video.js';
import { setUpPartnersReveal } from './modules/partners-reveal.js';
import { setUpServiceCards } from './modules/service-cards.js';
import { setUpProjectsReel } from './modules/projects-reel.js';
import { setUpProjectFilter } from './modules/project-filter.js';
import { setUpProjectCardPreviews } from './modules/project-cards.js';
import { setUpVideoPlayers } from './modules/video-players.js';
import { setUpLightbox } from './modules/lightbox.js';
import { startTimecode } from './modules/timecode.js';
import { setUpPodcastPlayer } from './modules/podcast-player.js';
import { setUpContactForm } from './modules/contact-form.js';
import { setUpHeadingFitting } from './modules/fit-headings.js';
import { setUpScrollReveal } from './modules/scroll-reveal.js';
import { findOne } from './modules/dom.js';

function startFeatures() {
  setUpSiteHeader();
  prepareVideosForAutoplay();

  // Home
  setUpHomeHeroVideo();
  setUpPartnersReveal();
  setUpServiceCards();

  // Projects
  setUpProjectsReel();
  setUpProjectFilter();
  setUpProjectCardPreviews();
  setUpVideoPlayers();
  setUpLightbox();

  // Podcasts
  if (findOne('#podcasts-hero')) startTimecode();
  setUpPodcastPlayer();

  // Contact
  setUpContactForm();

  // Every page
  const fitHeadings = setUpHeadingFitting();
  setUpScrollReveal();
  return fitHeadings;
}

let fitHeadings = () => {};
try {
  fitHeadings = startFeatures();
} finally {
  // the entrance animations are ready: show the page (hidden until now by layouts/base.njk)
  document.documentElement.classList.remove('is-preparing-page');
}

let resizeFrame = 0;
addEventListener('resize', () => {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    fitHeadings();
  });
});
