import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const SOURCE_PATH = require.resolve('../apps-script/Code.gs');
const source = readFileSync(SOURCE_PATH, 'utf8');

/** Loads Code.gs into a sandbox with minimal Apps Script service fakes. */
function loadScript({ volunteerCode = 'secret', headers = [], lockAcquired = true } = {}) {
  const written = [];
  const sheet = {
    getLastColumn: () => headers.length,
    getLastRow: () => 1,
    getRange: (row, col, rows, cols) => ({
      getValues: () => [headers],
      setValues: (values) => written.push({ row, col, rows, cols, values }),
    }),
  };
  const properties = { VOLUNTEER_CODE: volunteerCode, SPREADSHEET_ID: 'sheet-id' };
  const lock = { tryLock: vi.fn(() => lockAcquired), releaseLock: vi.fn() };
  const module = { exports: {} };
  const sandbox = {
    module,
    console: { error: () => {} },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (key) => properties[key] ?? null }),
    },
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({ setMimeType: () => JSON.parse(text) }),
    },
  };
  vm.runInNewContext(source, sandbox, { filename: SOURCE_PATH });
  return { api: module.exports, doPost: sandbox.doPost, written, lock };
}

const validParams = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  contact_number: '+91 98765 43210',
  wpm_count: '72',
  volunteer_code: 'secret',
};

describe('Apps Script helpers', () => {
  const { api } = loadScript();

  it('neutralises spreadsheet formula injection', () => {
    expect(api.sanitizeCell('=HYPERLINK("http://evil")')).toBe('\'=HYPERLINK("http://evil")');
    expect(api.sanitizeCell('+91 98765')).toBe("'+91 98765");
    expect(api.sanitizeCell('-1')).toBe("'-1");
    expect(api.sanitizeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(api.sanitizeCell('  Asha ')).toBe('Asha');
    expect(api.sanitizeCell(undefined)).toBe('');
  });

  it('compares volunteer codes safely', () => {
    expect(api.isValidVolunteerCode('secret', 'secret')).toBe(true);
    expect(api.isValidVolunteerCode(' secret ', 'secret')).toBe(true);
    expect(api.isValidVolunteerCode('secre', 'secret')).toBe(false);
    expect(api.isValidVolunteerCode('', '')).toBe(false);
    expect(api.isValidVolunteerCode('anything', null)).toBe(false);
  });

  it('validates registrations server-side', () => {
    expect(api.validateRegistration(validParams)).toEqual([]);
    expect(api.validateRegistration({ ...validParams, wpm_count: '9999' })).toHaveLength(1);
    expect(api.validateRegistration({})).toHaveLength(4);
  });

  it('builds rows by header and never stores private fields', () => {
    const now = new Date(0);
    const row = api.buildRow(
      ['timestamp', 'name', 'contact_number', 'volunteer_code', 'missing'],
      validParams,
      now,
    );
    expect(row).toEqual([now, 'Asha Rao', "'+91 98765 43210", '', '']);
  });
});

describe('doPost', () => {
  const headers = ['timestamp', 'name', 'email', 'contact_number', 'wpm_count'];

  it('rejects requests without a valid volunteer code', () => {
    const { doPost, written } = loadScript({ headers });
    const res = doPost({ parameter: { ...validParams, volunteer_code: 'wrong' } });
    expect(res).toMatchObject({ result: 'error', code: 'unauthorized' });
    expect(written).toHaveLength(0);
  });

  it('rejects everything when no volunteer code is configured', () => {
    const { doPost } = loadScript({ headers, volunteerCode: null });
    expect(doPost({ parameter: validParams })).toMatchObject({ code: 'unauthorized' });
  });

  it('answers verify requests without writing', () => {
    const { doPost, written } = loadScript({ headers });
    expect(doPost({ parameter: { action: 'verify', volunteer_code: 'secret' } })).toEqual({
      result: 'success',
    });
    expect(written).toHaveLength(0);
  });

  it('rejects invalid payloads', () => {
    const { doPost, written } = loadScript({ headers });
    expect(doPost({ parameter: { ...validParams, email: 'bad' } })).toMatchObject({
      code: 'invalid',
    });
    expect(written).toHaveLength(0);
  });

  it('appends a sanitised row and releases the lock', () => {
    const { doPost, written, lock } = loadScript({ headers });
    expect(doPost({ parameter: validParams })).toEqual({ result: 'success', row: 2 });
    expect(written).toHaveLength(1);
    expect(written[0].row).toBe(2);
    expect(written[0].values[0].slice(1)).toEqual([
      'Asha Rao',
      'asha@example.com',
      "'+91 98765 43210",
      '72',
    ]);
    expect(lock.releaseLock).toHaveBeenCalled();
  });

  it('reports busy when the lock cannot be acquired', () => {
    const { doPost, written } = loadScript({ headers, lockAcquired: false });
    expect(doPost({ parameter: validParams })).toMatchObject({ code: 'busy' });
    expect(written).toHaveLength(0);
  });
});
