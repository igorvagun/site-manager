import { useMemo } from 'react';
import { useI18n } from './i18n';

export const TASK_STATUS = { pending: 'neutral', active: 'blue', done: 'green', delayed: 'red', paused: 'yellow' };
export const FLOORS = ['מרתף', 'קרקע', 'א', 'ב', 'ג', 'ד', 'גג', 'חוץ'];
const FLOOR_KEYS = { מרתף: 'fl_basement', קרקע: 'fl_ground', א: 'fl_1', ב: 'fl_2', ג: 'fl_3', ד: 'fl_4', גג: 'fl_roof', חוץ: 'fl_ext' };
export const CATEGORIES = ['materials', 'labor', 'equipment', 'subcontractors', 'permits', 'other'];
export const ATTENDANCE = { present: 'green', absent: 'red', sick: 'orange', leave: 'neutral' };
export const ISSUE_STATUS = { open: 'orange', in_progress: 'blue', done: 'green' };
export const PRIORITY = { high: 'red', medium: 'orange', low: 'neutral' };
export const SAFETY_TYPES = { incident: 'red', near_miss: 'orange', hazard: 'yellow', inspection: 'blue', toolbox: 'green' };
export const WEATHER = { sunny: 'sun', cloudy: 'cloud', rain: 'rain', wind: 'wind' };
export const CHECKLIST = ['ppe', 'scaffolding', 'fall', 'electrical', 'housekeeping', 'fire'];
export const CO_STATUS = { pending: 'orange', approved: 'green', rejected: 'red' };

export function useOptions() {
  const { t } = useI18n();
  return useMemo(() => {
    const opts = (keys, prefix) => keys.map((k) => ({ value: k, label: t(prefix + k) }));
    const floorLabel = (f) => (FLOOR_KEYS[f] ? t(FLOOR_KEYS[f]) : f || '—');
    return {
      floorLabel,
      floors: FLOORS.map((f) => ({ value: f, label: floorLabel(f) })),
      taskStatus: opts(Object.keys(TASK_STATUS), 'st_'),
      categories: opts(CATEGORIES, 'cat_'),
      attendance: opts(Object.keys(ATTENDANCE), 'att_'),
      issueStatus: opts(Object.keys(ISSUE_STATUS), 'is_'),
      issueType: opts(['punch', 'rfi'], 'it_'),
      priority: opts(Object.keys(PRIORITY), 'pr_'),
      safetyType: opts(Object.keys(SAFETY_TYPES), 'sf_'),
      safetyStatus: opts(['open', 'closed'], 'ss_'),
      weather: opts(Object.keys(WEATHER), 'w_'),
      checklist: opts(CHECKLIST, 'ck_'),
      coStatus: opts(Object.keys(CO_STATUS), 'co_'),
      payStatus: opts(['paid', 'pending'], 'pay_'),
    };
  }, [t]);
}
