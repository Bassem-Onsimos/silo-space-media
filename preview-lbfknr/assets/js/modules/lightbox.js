import { findAll, findOne } from './dom.js';

/*
 * Project pages: tapping a photo opens it full screen. Arrows or swiping move between photos,
 * Escape closes. Pinch or double-tap (double-click on a laptop) zooms up to 4x; while zoomed,
 * one finger pans and swiping does not change photo.
 */
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const SWIPE_DISTANCE_TO_CHANGE = 50;

let photos = [];
let currentIndex = 0;
let viewer = null;

function createViewer() {
  const element = document.createElement('div');
  element.id = 'lightbox';
  element.className = 'lightbox';
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-label', 'Image viewer');
  element.innerHTML =
    '<img alt=""><button class="lightbox-close" aria-label="Close">×</button><button class="lightbox-arrow lightbox-previous" aria-label="Previous">←</button><button class="lightbox-arrow lightbox-next" aria-label="Next">→</button><span class="lightbox-count label"></span>';
  document.body.appendChild(element);

  element.addEventListener('click', (event) => {
    if (event.target === element || event.target.classList.contains('lightbox-close')) closeViewer();
  });
  findOne('.lightbox-previous', element).onclick = () => showStep(-1);
  findOne('.lightbox-next', element).onclick = () => showStep(1);
  addTouchGestures(element);
  return element;
}

function addTouchGestures(element) {
  const image = findOne('img', element);
  let busy = false;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let gesture = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let swipeDistance = 0;
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let pinchCenterX = 0;
  let pinchCenterY = 0;
  let panStartX = 0;
  let panStartY = 0;
  let lastTapTime = 0;

  const distanceBetween = (touches) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  const centreOf = (touches) => [
    (touches[0].clientX + touches[1].clientX) / 2,
    (touches[0].clientY + touches[1].clientY) / 2,
  ];
  const keepInsideScreen = () => {
    const maxX = Math.max(0, (image.offsetWidth * scale - innerWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * scale - innerHeight) / 2);
    offsetX = Math.max(-maxX, Math.min(maxX, offsetX));
    offsetY = Math.max(-maxY, Math.min(maxY, offsetY));
  };
  const draw = (animate, opacity = 1, slide = 0) => {
    image.style.transition = animate ? 'transform .25s ease-out, opacity .22s ease-out' : 'none';
    image.style.transform =
      slide || scale !== 1 || offsetX || offsetY ? `translate(${slide || offsetX}px,${offsetY}px) scale(${scale})` : '';
    image.style.opacity = opacity;
  };
  // zoom to newScale, keeping the screen point (pointX, pointY) still
  const zoomAt = (newScale, pointX, pointY, animate) => {
    const centreX = innerWidth / 2;
    const centreY = innerHeight / 2;
    const ratio = newScale / scale;
    offsetX = pointX - centreX - (pointX - centreX - offsetX) * ratio;
    offsetY = pointY - centreY - (pointY - centreY - offsetY) * ratio;
    scale = newScale;
    if (scale <= 1.01) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
    }
    keepInsideScreen();
    draw(animate);
  };
  element.resetZoom = () => {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    draw(false);
  };

  element.addEventListener(
    'touchstart',
    (event) => {
      if (busy) return;
      const touches = event.touches;
      if (touches.length === 2) {
        gesture = 'pinch';
        pinchStartDistance = distanceBetween(touches);
        pinchStartScale = scale;
        [pinchCenterX, pinchCenterY] = centreOf(touches);
        panStartX = offsetX;
        panStartY = offsetY;
        return;
      }
      const now = Date.now();
      const x = touches[0].clientX;
      const y = touches[0].clientY;
      if (now - lastTapTime < 300 && event.target === image) {
        lastTapTime = 0;
        gesture = null;
        zoomAt(scale > 1 ? 1 : DOUBLE_TAP_ZOOM, x, y, true);
        return;
      }
      lastTapTime = now;
      touchStartX = x;
      touchStartY = y;
      swipeDistance = 0;
      panStartX = offsetX;
      panStartY = offsetY;
      gesture = scale > 1 ? 'pan' : 'swipe';
    },
    { passive: true },
  );

  element.addEventListener(
    'touchmove',
    (event) => {
      const touches = event.touches;
      if (gesture === 'pinch' && touches.length === 2) {
        const newScale = Math.max(
          1,
          Math.min(MAX_ZOOM, (pinchStartScale * distanceBetween(touches)) / pinchStartDistance),
        );
        const [centreX, centreY] = centreOf(touches);
        offsetX = panStartX;
        offsetY = panStartY;
        scale = pinchStartScale;
        zoomAt(newScale, pinchCenterX, pinchCenterY, false);
        offsetX += centreX - pinchCenterX;
        offsetY += centreY - pinchCenterY;
        keepInsideScreen();
        draw(false);
        return;
      }
      if (gesture === 'pan') {
        offsetX = panStartX + (touches[0].clientX - touchStartX);
        offsetY = panStartY + (touches[0].clientY - touchStartY);
        keepInsideScreen();
        draw(false);
        return;
      }
      if (gesture === 'swipe') {
        swipeDistance = touches[0].clientX - touchStartX;
        if (Math.abs(swipeDistance) > Math.abs(touches[0].clientY - touchStartY))
          draw(false, 1 - Math.min(Math.abs(swipeDistance) / innerWidth, 0.5), swipeDistance);
      }
    },
    { passive: true },
  );

  element.addEventListener('touchend', (event) => {
    if (gesture === 'pinch') {
      if (event.touches.length === 1) {
        gesture = 'pan';
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        panStartX = offsetX;
        panStartY = offsetY;
      } else gesture = null;
      if (scale < 1.05) {
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        draw(true);
      }
      return;
    }
    if (gesture !== 'swipe') {
      gesture = null;
      return;
    }
    gesture = null;
    if (Math.abs(swipeDistance) < SWIPE_DISTANCE_TO_CHANGE || photos.length < 2) {
      draw(true, 1, 0);
      return;
    }
    // slide the photo out, swap it, then slide the next one in from the other side
    const direction = swipeDistance < 0 ? 1 : -1;
    busy = true;
    draw(true, 0, -direction * innerWidth);
    setTimeout(() => {
      showStep(direction);
      draw(false, 0, direction * innerWidth * 0.4);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          draw(true, 1, 0);
          setTimeout(() => {
            busy = false;
          }, 230);
        }),
      );
    }, 220);
  });

  image.addEventListener('dblclick', (event) =>
    zoomAt(scale > 1 ? 1 : DOUBLE_TAP_ZOOM, event.clientX, event.clientY, true),
  );
}

function showPhoto() {
  if (viewer.resetZoom) viewer.resetZoom();
  findOne('img', viewer).src = photos[currentIndex];
  findOne('.lightbox-count', viewer).textContent = `${currentIndex + 1} / ${photos.length}`;
}

function showStep(step) {
  currentIndex = (currentIndex + step + photos.length) % photos.length;
  showPhoto();
}

function openViewer(photoList, index) {
  photos = photoList;
  currentIndex = index;
  if (!viewer) viewer = createViewer();
  viewer.hidden = false;
  showPhoto();
  findOne('.lightbox-close', viewer).focus();
}

function closeViewer() {
  if (viewer) viewer.hidden = true;
}

export function setUpLightbox() {
  const photoButtons = findAll('[data-lightbox-photo]');
  if (!photoButtons.length) return;
  const photoList = photoButtons.map((button) => button.dataset.lightboxPhoto);
  photoButtons.forEach((button, index) => button.addEventListener('click', () => openViewer(photoList, index)));
  document.addEventListener('keydown', (event) => {
    if (!viewer || viewer.hidden) return;
    if (event.key === 'Escape') closeViewer();
    if (event.key === 'ArrowRight') showStep(1);
    if (event.key === 'ArrowLeft') showStep(-1);
  });
}
