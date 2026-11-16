import Dashboard from '../views/Dashboard';
import Schedule from '../views/Schedule';
import DailyLog from '../views/DailyLog';
import Team from '../views/Team';
import Budget from '../views/Budget';
import Issues from '../views/Issues';
import Safety from '../views/Safety';
import Materials from '../views/Materials';
import Settings from '../views/Settings';
import Positions from '../views/Positions';
import ProjectSettings from '../views/ProjectSettings';
import Drawings from '../views/Drawings';
import TaskJournal from '../views/TaskJournal';
import TimeClock from '../views/TimeClock';
import Receipts from '../views/Receipts';
import Todo from '../views/Todo';
import Contacts from '../views/Contacts';
import Insights from '../views/Insights';
import Accounts from '../views/Accounts';
import Equipment from '../views/Equipment';
import Calendar from '../views/Calendar';
import Overview from '../views/Overview';
import Photos from '../views/Photos';
import WeekPlan from '../views/WeekPlan';

const ALL = ['manager', 'foreman', 'worker'];
const LEAD = ['manager', 'foreman'];

// Sub-apps on a project's desktop, shown in these groups.
export const APP_GROUPS = ['work', 'people', 'money', 'control'];

export const PROJECT_APPS = [
  { id: 'dashboard', group: 'control', icon: 'grid', color: 'accent', view: Dashboard, roles: LEAD },
  { id: 'team', group: 'people', icon: 'users', color: 'green', view: Team, roles: LEAD },
  { id: 'schedule', group: 'work', icon: 'chart', color: 'red', view: Schedule, roles: ALL },
  { id: 'weekplan', group: 'work', icon: 'columns', color: 'aqua', view: WeekPlan, roles: LEAD },
  { id: 'calendar', group: 'work', icon: 'calendar', color: 'violet', view: Calendar, roles: ALL },
  { id: 'log', group: 'work', icon: 'book', color: 'orange', view: DailyLog, roles: ALL },
  { id: 'budget', group: 'money', icon: 'wallet', color: 'indigo', view: Budget, roles: ['manager'] },
  { id: 'issues', group: 'control', icon: 'check', color: 'blue', view: Issues, roles: ALL },
  { id: 'safety', group: 'control', icon: 'shield', color: 'teal', view: Safety, roles: ALL },
  { id: 'materials', group: 'money', icon: 'box', color: 'brown', view: Materials, roles: LEAD },
  { id: 'equipment', group: 'money', icon: 'truck', color: 'rust', view: Equipment, roles: LEAD },
  { id: 'drawings', group: 'work', icon: 'layers', color: 'cyan', view: Drawings, roles: ALL },
  { id: 'photos', group: 'work', icon: 'camera', color: 'peach', view: Photos, roles: ALL },
  { id: 'tasklog', group: 'work', icon: 'chat', color: 'mint', view: TaskJournal, roles: ALL },
  { id: 'timeclock', group: 'people', icon: 'clock', color: 'yellow', view: TimeClock, roles: ALL },
  { id: 'receipts', group: 'money', icon: 'receipt', color: 'pink', view: Receipts, roles: LEAD },
  { id: 'todo', group: 'control', icon: 'list', color: 'slate', view: Todo, roles: ['manager'] },
  { id: 'contacts', group: 'people', icon: 'phone', color: 'lime', view: Contacts, roles: LEAD },
  { id: 'insights', group: 'control', icon: 'sparkle', color: 'purple', view: Insights, roles: ['manager'] },
  { id: 'style', group: 'control', icon: 'gear', color: 'gray', view: ProjectSettings, roles: ['manager'] },
];

// Sub-apps on the account-level home desktop.
export const HOME_APPS = [
  { id: 'overview', icon: 'chart', color: 'blue', view: Overview, roles: ['manager'] },
  { id: 'accounts', icon: 'users', color: 'green', view: Accounts, roles: ['manager'] },
  { id: 'positions', icon: 'idcard', color: 'indigo', view: Positions, roles: ['manager'] },
  { id: 'settings', icon: 'gear', color: 'gray', view: Settings, roles: ALL },
];

export const WALLPAPERS = ['aurora', 'ocean', 'sunset', 'forest', 'rose', 'graphite'];
export const ACCENTS = ['blue', 'indigo', 'purple', 'pink', 'orange', 'green', 'teal'];
