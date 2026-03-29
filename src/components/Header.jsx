import { fmtMoney } from '../lib/utils';

export default function Header({ stats }) {
  return (
    <div className="header">
      <div className="header-brand">
        <div className="brand-icon">IS</div>
        <div>
          <div className="brand-title">SITE CONTROL</div>
          <div className="brand-sub">IMMORTAL SENTINEL // ניהול אתר</div>
        </div>
      </div>

      <div className="header-stats">
        <div className="stat-pill">
          <div className="stat-val">{stats.totalTasks}</div>
          <div className="stat-lbl">משימות</div>
        </div>

        <div className="stat-pill">
          <div className="stat-val" style={{ color: 'var(--green)' }}>
            {stats.doneCount}
          </div>
          <div className="stat-lbl">הושלמו</div>
        </div>

        <div className="stat-pill">
          <div className="stat-val" style={{ color: 'var(--accent)' }}>
            {stats.activeCount}
          </div>
          <div className="stat-lbl">פעילות</div>
        </div>

        <div className="stat-pill">
          <div className="stat-val" style={{ color: 'var(--accent2)' }}>
            {fmtMoney(stats.activeDailyCost)}/י
          </div>
          <div className="stat-lbl">עלות יומית</div>
        </div>

        <div className="stat-pill">
          <div className="stat-val" style={{ color: 'var(--yellow)' }}>
            {fmtMoney(stats.totalBudget)}
          </div>
          <div className="stat-lbl">תקציב כולל</div>
        </div>
      </div>
    </div>
  );
}
