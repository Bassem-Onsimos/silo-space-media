import { findAll, hasMousePointer } from './dom.js';

/* Home page: service cards flip over on hover with a mouse (CSS); on touch screens a tap flips one card at a time. */
export function setUpServiceCards() {
  findAll('.service-card').forEach((card) =>
    card.addEventListener('click', () => {
      if (hasMousePointer()) return;
      const turnOver = !card.classList.contains('is-active');
      findAll('.service-card.is-active').forEach((openCard) => {
        openCard.classList.remove('is-active');
        openCard.setAttribute('aria-pressed', 'false');
      });
      card.classList.toggle('is-active', turnOver);
      card.setAttribute('aria-pressed', String(turnOver));
    }),
  );
}
