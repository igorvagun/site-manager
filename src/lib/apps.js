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

const ALL = ['manager', 'foreman', 'worker'];
const LEAD = ['manager', 'foreman'];

// Sub-apps on a project's desktop. `soon` marks apps planned for the next phase.
export const PROJECT_APPS = [
  { id: 'dashboard', icon: 'grid', color: 'blue', view: Dashboard, roles: LEAD },
  { id: 'team', icon: 'users', color: 'green', view: Team, roles: LEAD },
  { id: 'schedule', icon: 'calendar', color: 'red', view: Schedule, roles: ALL },
  { id: 'log', icon: 'book', color: 'orange', view: DailyLog, roles: ALL },
  { id: 'budget', icon: 'wallet', color: 'purple', view: Budget, roles: ['manager'] },
  { id: 'issues', icon: 'check', color: 'indigo', view: Issues, roles: ALL },
  { id: 'safety', icon: 'shield', color: 'teal', view: Safety, roles: ALL },
  { id: 'materials', icon: 'box', color: 'brown', view: Materials, roles: LEAD },
  { id: 'drawings', icon: 'layers', color: 'cyan', soon: true, roles: ALL },
  { id: 'tasklog', icon: 'chat', color: 'mint', soon: true, roles: ALL },
  { id: 'timeclock', icon: 'clock', color: 'yellow', soon: true, roles: ALL },
  { id: 'receipts', icon: 'receipt', color: 'pink', soon: true, roles: LEAD },
  { id: 'todo', icon: 'list', color: 'slate', soon: true, roles: ['manager'] },
  { id: 'contacts', icon: 'phone', color: 'lime', soon: true, roles: LEAD },
  { id: 'style', icon: 'gear', color: 'gray', view: ProjectSettings, roles: ['manager'] },
];

// Sub-apps on the account-level home desktop.
export const HOME_APPS = [
  { id: 'positions', icon: 'idcard', color: 'indigo', view: Positions, roles: ['manager'] },
  { id: 'settings', icon: 'gear', color: 'gray', view: Settings, roles: ALL },
];

export const WALLPAPERS = ['aurora', 'ocean', 'sunset', 'forest', 'rose', 'graphite'];
export const ACCENTS = ['blue', 'indigo', 'purple', 'pink', 'orange', 'green', 'teal'];
