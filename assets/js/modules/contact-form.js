import { findOne } from './dom.js';

const REQUIRED_FIELDS = ['first', 'last', 'email', 'phone'];

/* Contact page: checks the form before "sending". Not connected to an inbox yet, so it says so. */
export function setUpContactForm() {
  const form = findOne('#contact-request');
  if (!form) return;
  const note = findOne('#form-note');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = form.elements;
    const emptyFields = REQUIRED_FIELDS.filter((name) => !fields[name].value.trim());
    if (emptyFields.length) {
      note.textContent = 'Please fill in your name, email and phone so we can reach you.';
      fields[emptyFields[0]].focus();
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(fields.email.value)) {
      note.textContent = 'That email address looks incomplete. Check it and try again.';
      fields.email.focus();
      return;
    }
    note.textContent = `Thanks, ${fields.first.value.trim()}. This is a design preview, so the form isn't connected yet.`;
  });
}
