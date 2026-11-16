import { useRef, useState } from 'react';
import { useI18n, labelsOf } from '../lib/i18n';
import { notify } from '../lib/store';
import { parseCSV } from '../lib/csv';
import { downloadFile } from '../lib/utils';
import { Icon, Modal } from './ui';

// Import rows from a CSV file. `fields`: [{ key, labelKey, aliases?, required?, parse? }].
// Columns are matched to fields by header name in any interface language and can be re-mapped by hand.
export default function ImportDialog({ title, fields, sample, onImport, onClose }) {
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [table, setTable] = useState(null); // { head, rows }
  const [map, setMap] = useState({});

  const guess = (head) => {
    const norm = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const m = {};
    fields.forEach((f) => {
      const names = [...labelsOf(f.labelKey), ...(f.aliases || []), f.key].map(norm);
      const i = head.findIndex((h) => names.includes(norm(h)));
      m[f.key] = i >= 0 ? String(i) : '';
    });
    return m;
  };
  const load = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const rows = parseCSV(await file.text());
    if (rows.length < 2) return notify('import_empty', 'error');
    setTable({ head: rows[0], rows: rows.slice(1) });
    setMap(guess(rows[0]));
  };
  const convert = () =>
    table.rows
      .map((r) => {
        const out = {};
        fields.forEach((f) => {
          const raw = map[f.key] === '' ? '' : r[Number(map[f.key])] ?? '';
          out[f.key] = f.parse ? f.parse(raw) : raw;
        });
        return out;
      })
      .filter((row) => fields.every((f) => !f.required || (row[f.key] !== '' && row[f.key] != null)));
  const ready = table ? convert() : [];
  const missing = fields.filter((f) => f.required && map[f.key] === '');

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button className="btn primary" onClick={() => fileRef.current.click()}>
          <Icon name="upload" size={16} />
          {t('import_choose')}
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" hidden onChange={load} />
        <button className="btn" onClick={() => downloadFile('sample.csv', '﻿' + sample, 'text/csv;charset=utf-8')}>
          <Icon name="download" size={16} />
          {t('import_sample')}
        </button>
      </div>
      {!table && <p className="muted import-hint">{t('import_hint')}</p>}
      {table && (
        <>
          <h4 className="import-h">{t('import_columns')}</h4>
          <div className="form-grid">
            {fields.map((f) => (
              <div className="field half" key={f.key}>
                <label htmlFor={'imp-' + f.key}>
                  {t(f.labelKey)}
                  {f.required && <i> *</i>}
                </label>
                <select id={'imp-' + f.key} value={map[f.key]} onChange={(e) => setMap((m) => ({ ...m, [f.key]: e.target.value }))}>
                  <option value="">{t('import_skip')}</option>
                  {table.head.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `#${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <h4 className="import-h">
            {t('import_preview')} · {ready.length}/{table.rows.length}
          </h4>
          <div className="table-wrap import-table">
            <table>
              <thead>
                <tr>{fields.map((f) => <th key={f.key}>{t(f.labelKey)}</th>)}</tr>
              </thead>
              <tbody>
                {ready.slice(0, 5).map((row, i) => (
                  <tr key={i}>{fields.map((f) => <td key={f.key}>{String(row[f.key] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {missing.length > 0 && <p className="form-error">{t('required_missing')}: {missing.map((f) => t(f.labelKey)).join(', ')}</p>}
          {ready.length < table.rows.length && missing.length === 0 && <p className="muted">{t('import_skipped')}: {table.rows.length - ready.length}</p>}
        </>
      )}
      <div className="modal-foot">
        <span className="spacer" />
        <button className="btn" onClick={onClose}>{t('cancel')}</button>
        <button
          className="btn primary"
          disabled={!ready.length || missing.length > 0}
          onClick={async () => {
            await onImport(ready);
            notify('import_done');
            onClose();
          }}
        >
          {t('import_go')} {ready.length > 0 && `(${ready.length})`}
        </button>
      </div>
    </Modal>
  );
}
