import { findAll, findOne } from './dom.js';

/* Projects page: the filter chips show only the projects that list the chosen service. */
export function setUpProjectFilter() {
  const chips = findAll('[data-filter]');
  const list = findOne('#project-list');
  if (!chips.length || !list) return;
  const cards = findAll('.card', list);

  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const service = chip.dataset.filter;
      chips.forEach((otherChip) => otherChip.setAttribute('aria-pressed', otherChip === chip));
      cards.forEach((card) => {
        card.hidden = service !== 'All' && !card.dataset.services.split('|').includes(service);
      });
    }),
  );
}
