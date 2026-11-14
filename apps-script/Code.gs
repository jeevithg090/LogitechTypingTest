/**
 * Google Apps Script backend for the typing-test giveaway kiosk.
 *
 * Deploy as a web app bound to a Google Sheet. Rows are appended to the sheet
 * named by SHEET_NAME; columns are matched by the header row (row 1).
 *
 * Script Properties (Project Settings -> Script properties):
 *   VOLUNTEER_CODE  Secret code volunteers enter to unlock the WPM field.
 *                   Required. Never commit it to the repository.
 *   SPREADSHEET_ID  Set automatically by running initialSetup() once.
 *
 * Requests (POST, form-encoded):
 *   action=verify   Checks volunteer_code only. Responds { result: "success" }.
 *   (default)       Validates and appends a registration row.
 */

var SHEET_NAME = 'Sheet1';
var MAX_WPM = 300;
var LOCK_TIMEOUT_MS = 10000;
// Fields that are accepted from the client but must never be written to the sheet.
var PRIVATE_FIELDS = ['volunteer_code', 'action'];

/** Run once from the Apps Script editor to remember the bound spreadsheet. */
function initialSetup() {
  var activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', activeSpreadsheet.getId());
}

/** Backwards-compatible alias for the original (misspelled) setup function. */
function intialSetup() {
  initialSetup();
}

// ---------------------------------------------------------------------------
// Pure helpers (no Apps Script services) - covered by the unit tests.
// ---------------------------------------------------------------------------

function trimValue(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/**
 * Prevents spreadsheet formula injection: values beginning with = + - @ (or a
 * tab/carriage return) would otherwise be evaluated by Google Sheets. A leading
 * apostrophe forces the cell to be stored as plain text.
 */
function sanitizeCell(value) {
  var text = trimValue(value);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

/** Constant-time-ish string comparison to avoid trivially leaking the code. */
function safeEquals(a, b) {
  var left = String(a);
  var right = String(b);
  var diff = left.length ^ right.length;
  var length = Math.max(left.length, right.length);
  for (var i = 0; i < length; i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function isValidVolunteerCode(supplied, expected) {
  if (!expected) return false;
  return safeEquals(trimValue(supplied), expected);
}

/**
 * Validates a registration payload. Returns a list of human-readable errors
 * (empty when the payload is valid).
 */
function validateRegistration(params) {
  var errors = [];
  var name = trimValue(params.name);
  var email = trimValue(params.email);
  var phoneDigits = trimValue(params.contact_number).replace(/\D/g, '');
  var wpm = trimValue(params.wpm_count);

  if (name.length < 2 || name.length > 100) {
    errors.push('Name must be between 2 and 100 characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    errors.push('Email address is invalid.');
  }
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.push('Contact number is invalid.');
  }
  if (!/^\d+$/.test(wpm) || Number(wpm) > MAX_WPM) {
    errors.push('WPM count must be a whole number between 0 and ' + MAX_WPM + '.');
  }
  return errors;
}

/** Maps sheet headers to a row of sanitised values. */
function buildRow(headers, params, now) {
  return headers.map(function (header) {
    if (header === 'timestamp') return now;
    if (PRIVATE_FIELDS.indexOf(header) !== -1) return '';
    return sanitizeCell(params[header]);
  });
}

// ---------------------------------------------------------------------------
// Web app entry point
// ---------------------------------------------------------------------------

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  var params = (e && e.parameter) || {};
  var props = PropertiesService.getScriptProperties();

  if (!isValidVolunteerCode(params.volunteer_code, props.getProperty('VOLUNTEER_CODE'))) {
    return jsonResponse({
      result: 'error',
      code: 'unauthorized',
      error: 'Invalid volunteer code.',
    });
  }

  if (params.action === 'verify') {
    return jsonResponse({ result: 'success' });
  }

  var errors = validateRegistration(params);
  if (errors.length > 0) {
    return jsonResponse({ result: 'error', code: 'invalid', error: errors.join(' ') });
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
    return jsonResponse({ result: 'error', code: 'busy', error: 'Server is busy. Please retry.' });
  }

  try {
    var doc = SpreadsheetApp.openById(props.getProperty('SPREADSHEET_ID'));
    var sheet = doc.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var nextRow = sheet.getLastRow() + 1;
    var newRow = buildRow(headers, params, new Date());

    sheet.getRange(nextRow, 1, 1, newRow.length).setValues([newRow]);
    return jsonResponse({ result: 'success', row: nextRow });
  } catch (err) {
    console.error(err);
    return jsonResponse({ result: 'error', code: 'server', error: 'Could not save registration.' });
  } finally {
    lock.releaseLock();
  }
}

// Allows the pure helpers to be unit-tested under Node; ignored by Apps Script.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sanitizeCell: sanitizeCell,
    safeEquals: safeEquals,
    isValidVolunteerCode: isValidVolunteerCode,
    validateRegistration: validateRegistration,
    buildRow: buildRow,
    MAX_WPM: MAX_WPM,
  };
}
