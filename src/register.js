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
const progressText = byId('form-progress-text');
const successPanel = byId('success-panel');
const successMessage = byId('success-message');
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

// --- Loading state ---------------------------------------------------------

/** @param {HTMLButtonElement} button @param {boolean} loading @param {string} label */
function setLoading(button, loading, label) {
  button.disabled = loading;
  button.toggleAttribute('aria-busy', loading);
  button.replaceChildren();
  if (loading) {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    button.append(spinner);
  }
  button.append(label);
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
  progressText.textContent = `${percent}%`;
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

  setLoading(volunteerSubmit, true, 'Checking…');
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
    setLoading(volunteerSubmit, false, 'Unlock');
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

  setLoading(submitButton, true, 'Submitting…');

  try {
    await postToScript(config.scriptUrl, {
      name: data.name.trim(),
      email: data.email.trim(),
      contact_number: data.contact_number.trim(),
      wpm_count: data.wpm_count.trim(),
      volunteer_code: volunteerCode,
    });
    showSuccess(data.name.trim());
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
  } finally {
    setLoading(submitButton, false, 'Submit registration');
  }
});

// --- Success ---------------------------------------------------------------

let redirectTimer = 0;

/** Swaps the form for a confirmation panel and counts down back to the home screen. */
function showSuccess(name) {
  form.reset();
  setWpmUnlocked(false);
  updateProgress();
  for (const field of FIELDS) setFieldError(field, '');
  statusBox.hidden = true;
  form.hidden = true;
  byId('back-home').hidden = true;
  successPanel.hidden = false;
  successPanel.focus();

  let remaining = config.redirectSeconds;
  const firstName = name.split(/\s+/)[0];
  const render = () => {
    successMessage.textContent = `Thanks, ${firstName}! Your score has been recorded. Returning to the home screen in ${remaining} second${remaining === 1 ? '' : 's'}…`;
  };
  render();
  redirectTimer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      window.clearInterval(redirectTimer);
      window.location.assign('/');
    } else {
      render();
    }
  }, 1000);
}

byId('register-another').addEventListener('click', () => {
  window.clearInterval(redirectTimer);
  successPanel.hidden = true;
  form.hidden = false;
  byId('back-home').hidden = false;
  /** @type {HTMLInputElement} */ (form.elements.namedItem('name')).focus();
});

updateProgress();
startParticles(/** @type {HTMLCanvasElement} */ (byId('particles')));
