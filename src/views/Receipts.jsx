import { useRef, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useData, addRow, updateRow, removeRow, notify } from '../lib/store';
import { putFile, deleteFile, useFileURL, dataURLToBlob } from '../lib/files';
import { aiAvailable, aiCall } from '../lib/ai';
import { useOptions, CATEGORIES } from '../lib/constants';
import { Glass, Icon, Badge, Field, Empty, PageHead, Stat, Modal } from '../components/ui';
import { todayISO, fmtDate, fmtMoney, fmtMoneyFull, sum, resizeImage } from '../lib/utils';

function ReceiptImage({ id, className }) {
  const { url, missing } = useFileURL(id);
  if (missing) return <div className={`${className} placeholder`}><Icon name="receipt" size={30} /></div>;
  return url ? <img className={className} src={url} alt="" /> : <div className={`${className} placeholder`} />;
}

// Photograph a receipt → (AI reads it when connected) → check the fields → saved as a project expense.
function ReceiptForm({ expense, onClose }) {
  const { t, lang } = useI18n();
  const o = useOptions();
  const data = useData();
  const cur = data.project[0]?.currency || '₪';
  const [form, setForm] = useState(expense || { description: '', vendor: '', amount: '', date: todayISO(), category: 'materials', status: 'paid' });
  const [photo, setPhoto] = useState(null); // data URL of a newly taken photo
  const [scan, setScan] = useState(expense ? 'idle' : 'need_photo'); // need_photo | scanning | ai_done | manual | ai_failed | idle
  const [tried, setTried] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const onPhoto = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let url;
    try {
      url = await resizeImage(f, 1600, 0.82);
    } catch {
      return notify('bad_image', 'error');
    }
    setPhoto(url);
    if (!aiAvailable()) return setScan('manual');
    setScan('scanning');
    try {
      const r = await aiCall('receipt', { image: url.split(',')[1], media_type: 'image/jpeg', categories: CATEGORIES, lang });
      setForm((s) => ({
        ...s,
        vendor: r.vendor || s.vendor,
        description: r.description || s.description,
        amount: typeof r.total === 'number' ? r.total : s.amount,
        date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : s.date,
        category: CATEGORIES.includes(r.category) ? r.category : s.category,
      }));
      setScan('ai_done');
    } catch (err) {
      console.error(err);
      setScan('ai_failed');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setTried(true);
    if (!form.description.trim() || form.amount === '' || !form.date) return;
    const row = { ...form, amount: Number(form.amount) || 0 };
    try {
      if (photo) {
        if (expense?.receipt_id) deleteFile(expense.receipt_id);
        row.receipt_id = await putFile(await dataURLToBlob(photo));
      }
    } catch (err) {
      console.error(err);
      return notify('upload_failed', 'error');
    }
    expense ? updateRow('expenses', expense.id, row) : addRow('expenses', row);
    onClose();
  };

  const fields = [
    { key: 'vendor', label: t('vendor'), half: true },
    { key: 'date', label: t('date'), type: 'date', required: true, half: true },
    { key: 'description', label: t('description'), required: true },
    { key: 'amount', label: `${t('amount')} (${cur})`, type: 'number', required: true, half: true },
    { key: 'category', label: t('category'), type: 'select', options: o.categories, half: true },
    { key: 'status', label: t('payment'), type: 'select', options: o.payStatus, half: true },
  ];

  return (
    <Modal title={expense ? t('receipt') : t('scan_receipt')} onClose={onClose} wide>
      <form className="receipt-form" onSubmit={save} noValidate>
        <div className="receipt-photo">
          {photo ? <img className="receipt-full" src={photo} alt="" /> : expense?.receipt_id ? <ReceiptImage id={expense.receipt_id} className="receipt-full" /> : <div className="receipt-full placeholder"><Icon name="camera" size={40} /></div>}
          <button type="button" className="btn" onClick={() => fileRef.current.click()} disabled={scan === 'scanning'}>
            <Icon name="camera" size={16} />
            {photo || expense?.receipt_id ? t('retake_photo') : t('take_photo')}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
        </div>
        <div>
          {scan === 'scanning' && <p className="scan-note"><span className="spinner small" /> {t('receipt_scanning')}</p>}
          {scan === 'ai_done' && <p className="scan-note ok"><Icon name="sparkle" size={16} /> {t('receipt_ai_done')}</p>}
          {scan === 'manual' && <p className="scan-note"><Icon name="alert" size={16} /> {t('receipt_ai_off')}</p>}
          {scan === 'ai_failed' && <p className="scan-note bad"><Icon name="alert" size={16} /> {t('receipt_ai_failed')}</p>}
          {scan === 'need_photo' && <p className="scan-note">{t('receipt_need_photo')}</p>}
          <div className="form-grid">
            {fields.map((f) => (
              <Field key={f.key} field={f} value={form[f.key]} onChange={set(f.key)} />
            ))}
          </div>
          {tried && (!form.description.trim() || form.amount === '') && <p className="form-error" role="alert">{t('required_missing')}</p>}
          <div className="modal-foot">
            {expense && (
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  if (!confirm(t('confirm_delete'))) return;
                  deleteFile(expense.receipt_id);
                  removeRow('expenses', expense.id);
                  onClose();
                }}
              >
                <Icon name="trash" size={16} />
                {t('delete')}
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn primary" disabled={scan === 'scanning'}>{t('save_expense')}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function Receipts() {
  const { t, lang } = useI18n();
  const data = useData();
  const cur = data.project[0]?.currency || '₪';
  const [form, setForm] = useState(null); // 'new' | expense
  const receipts = data.expenses.filter((e) => e.receipt_id).sort((a, b) => b.date.localeCompare(a.date));
  const month = todayISO().slice(0, 7);

  return (
    <>
      <PageHead title={t('nav_receipts')} subtitle={t('receipts_sub')}>
        <button className="btn primary" onClick={() => setForm('new')}>
          <Icon name="camera" size={16} />
          {t('scan_receipt')}
        </button>
      </PageHead>

      <div className="grid stats three">
        <Stat icon="receipt" tone="blue" label={t('receipts_count')} value={receipts.length} sub={t('receipts_word')} />
        <Stat icon="wallet" tone="purple" label={t('receipts_total')} value={fmtMoney(sum(receipts, (e) => e.amount), cur)} sub={t('added_to_expenses')} />
        <Stat icon="calendar" tone="green" label={t('this_month')} value={fmtMoney(sum(receipts.filter((e) => e.date.startsWith(month)), (e) => e.amount), cur)} sub={fmtDate(todayISO(), lang, { month: 'long' })} />
      </div>
      {!aiAvailable() && (
        <Glass className="notice">
          <Icon name="sparkle" size={18} />
          <span>{t('receipt_ai_off_long')}</span>
        </Glass>
      )}

      {receipts.length === 0 ? (
        <Glass><Empty icon="receipt" text={t('no_receipts')} /></Glass>
      ) : (
        <div className="grid receipt-grid">
          {receipts.map((e) => (
            <Glass as="button" className="receipt" key={e.id} onClick={() => setForm(e)}>
              <ReceiptImage id={e.receipt_id} className="receipt-thumb" />
              <div>
                <b>{fmtMoneyFull(e.amount, cur)}</b>
                <span>{e.vendor || e.description}</span>
                <small>
                  {fmtDate(e.date, lang, { day: 'numeric', month: 'short', year: '2-digit' })} · {t('cat_' + e.category)}
                </small>
                <Badge tone={e.status === 'paid' ? 'green' : 'orange'}>{t('pay_' + e.status)}</Badge>
              </div>
            </Glass>
          ))}
        </div>
      )}
      {form && <ReceiptForm expense={form === 'new' ? null : form} onClose={() => setForm(null)} />}
    </>
  );
}
