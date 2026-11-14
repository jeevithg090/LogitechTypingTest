import { ApiError, postToScript, verifyVolunteerCode } from './lib/api.js';
import { config } from './lib/config.js';
import { startParticles } from './lib/particles.js';
import { DEFAULT_PREFIX, applyPaste, withPrefix, wouldDeletePrefix } from './lib/phone.js';
import { completionPercent } from './lib/progress.js';
import { validateField, validateRegistration } from './lib/validation.js';

/** @template {HTMLElement} T @param {string} id @returns {T} */
const byId = (id) => /** @type {T} */ (document.getElementById(id));

const form = /** @type {HTMLFormElement} */ (byId('registration-form'));
const submitButton = /** @type {HTMLButtonElement} */ (byId('submit-button'));
const statusBox = byId('form-status');
const progress = byId('form-progress');
const progressBar = byId('form-progress-bar');
const phoneInput = /** @type {HTMLInputElement} */ (byId('contact_number'));
const wpmInput = /** @type {HTMLInputElement} */ (byId('wpm_count'));
const lockButton = /** @type {HTMLButtonElement} */ (byId('lock-button'));
const dialog = /** @type {HTMLDialogElement} */ (byId('volunteer-dialog'));
const volunteerForm = /** @type {HTMLFormElement} */ (byId('volunteer-form'));
const volunteerInput = /** @type {HTMLInputElement} */ (byId('volunteer-code'));
const volunteerError = byId('volunteer-code-error');
const volunteerSubmit = /** @type {HTMLButtonElement} */ (byId('volunteer-submit'));

const FIELDS = ['name', 'email', 'contact_number', 'wpm_count'];

/** Code entered by the volunteer; kept in memory only and re-checked by the server on submit. */
let volunteerCode = '';

byId('prize-name').textContent = config.prizeName;
if (!config.scriptUrl) {
  byId('config-warning').hidden = false;
  submitButton.disabled = true;
  lockButton.disabled = true;
}

// --- Field errors ----------------------------------------------------------

/** @param {string} field @param {string} message */
function setFieldError(field, message) {
  const input = /** @type {HTMLInputElement} */ (form.elements.namedItem(field));
  byId(`${field}-error`).textContent = message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function readForm() {
  /** @type {Record<string, string>} */
  const data = {};
  for (const field of FIELDS) {
    data[field] = /** @type {HTMLInputElement} */ (form.elements.namedItem(field)).value;
  }
  return data;
}

// --- Status / progress -----------------------------------------------------

/** @param {'success' | 'error' | 'info'} kind @param {string} message */
function showStatus(kind, message) {
  statusBox.className = `status status-${kind}`;
  statusBox.textContent = message;
  statusBox.hidden = false;
}

function updateProgress() {
  const percent = completionPercent(
    FIELDS.map((field) => ({
      value: /** @type {HTMLInputElement} */ (form.elements.namedItem(field)).value,
      emptyValue: field === 'contact_number' ? DEFAULT_PREFIX : '',
    })),
  );
  progressBar.style.width = `${percent}%`;
  progress.setAttribute('aria-valuenow', String(percent));
}

form.addEventListener('input', (event) => {
  const target = /** @type {HTMLInputElement} */ (event.target);
  if (target.getAttribute('aria-invalid') === 'true') {
    setFieldError(target.name, validateField(target.name, target.value));
  }
  updateProgress();
});

form.addEventListener('focusout', (event) => {
  const target = /** @type {HTMLInputElement} */ (event.target);
  if (FIELDS.includes(target.name) && target.value.trim() && target.value !== DEFAULT_PREFIX) {
    setFieldError(target.name, validateField(target.name, target.value));
  }
});

// --- Contact number prefix -------------------------------------------------

phoneInput.addEventListener('input', () => {
  const normalised = withPrefix(phoneInput.value);
  if (normalised !== phoneInput.value) phoneInput.value = normalised;
});

phoneInput.addEventListener('keydown', (event) => {
  const { selectionStart, selectionEnd } = phoneInput;
  if (wouldDeletePrefix(event.key, selectionStart ?? 0, selectionEnd ?? 0)) {
    event.preventDefault();
  }
});

phoneInput.addEventListener('cut', (event) => {
  if ((phoneInput.selectionStart ?? 0) < DEFAULT_PREFIX.length) event.preventDefault();
});

phoneInput.addEventListener('paste', (event) => {
  event.preventDefault();
  const pasted = event.clipboardData?.getData('text') ?? '';
  phoneInput.value = applyPaste(
    phoneInput.value,
    pasted,
    phoneInput.selectionStart ?? phoneInput.value.length,
    phoneInput.selectionEnd ?? phoneInput.value.length,
  );
  updateProgress();
});

// --- Volunteer lock --------------------------------------------------------

/** @param {boolean} unlocked */
function setWpmUnlocked(unlocked) {
  wpmInput.disabled = !unlocked;
  lockButton.textContent = unlocked ? 'Lock' : 'Unlock';
  lockButton.classList.toggle('is-unlocked', unlocked);
  lockButton.setAttribute('aria-pressed', String(unlocked));
  if (!unlocked) volunteerCode = '';
}

lockButton.addEventListener('click', () => {
  if (!wpmInput.disabled) {
    setWpmUnlocked(false);
    showStatus('info', 'WPM field locked.');
    return;
  }
  volunteerInput.value = '';
  volunteerError.textContent = '';
  dialog.showModal();
  volunteerInput.focus();
});

byId('volunteer-cancel').addEventListener('click', () => dialog.close());

volunteerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = volunteerInput.value.trim();
  if (!code) {
    volunteerError.textContent = 'Please enter the volunteer code.';
    return;
  }

  volunteerSubmit.disabled = true;
  volunteerSubmit.textContent = 'Checking…';
  try {
    await verifyVolunteerCode(config.scriptUrl, code);
    volunteerCode = code;
    dialog.close();
    setWpmUnlocked(true);
    wpmInput.focus();
  } catch (error) {
    volunteerError.textContent =
      error instanceof ApiError && error.code === 'unauthorized'
        ? 'Incorrect volunteer code.'
        : error instanceof Error
          ? error.message
          : 'Could not verify the code.';
  } finally {
    volunteerSubmit.disabled = false;
    volunteerSubmit.textContent = 'Unlock';
  }
});

// --- Submission ------------------------------------------------------------

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusBox.hidden = true;

  const data = readForm();
  const errors = validateRegistration(data);
  for (const field of FIELDS) setFieldError(field, errors[field] ?? '');

  const firstInvalid = FIELDS.find((field) => errors[field]);
  if (firstInvalid) {
    const input = /** @type {HTMLInputElement} */ (form.elements.namedItem(firstInvalid));
    if (input.disabled) lockButton.focus();
    else input.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');
  submitButton.textContent = 'Submitting…';

  try {
    await postToScript(config.scriptUrl, {
      name: data.name.trim(),
      email: data.email.trim(),
      contact_number: data.contact_number.trim(),
      wpm_count: data.wpm_count.trim(),
      volunteer_code: volunteerCode,
    });

    form.reset();
    submitButton.textContent = 'Submitted';
    setWpmUnlocked(false);
    updateProgress();
    showStatus(
      'success',
      `Thanks! Your registration was submitted. Returning to the home screen in ${config.redirectSeconds} seconds…`,
    );
    setTimeout(() => window.location.assign('/'), config.redirectSeconds * 1000);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'unauthorized') {
      setWpmUnlocked(false);
      showStatus(
        'error',
        'The volunteer code is no longer valid. Please unlock the WPM field again.',
      );
    } else {
      showStatus('error', error instanceof Error ? error.message : 'Something went wrong.');
    }
    submitButton.disabled = false;
    submitButton.textContent = 'Submit registration';
  } finally {
    submitButton.removeAttribute('aria-busy');
  }
});

updateProgress();
startParticles(/** @type {HTMLCanvasElement} */ (byId('particles')));
