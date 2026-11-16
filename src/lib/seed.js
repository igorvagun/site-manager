import { todayISO, addDays, parseISO, uid } from './utils';

// Demo data, generated relative to today so the dashboard always looks alive.
export const USER_IDS = {
  manager: '00000000-0000-4000-8000-000000000001',
  foreman: '00000000-0000-4000-8000-000000000002',
  worker: '00000000-0000-4000-8000-000000000003',
};
const P1 = '00000000-0000-4000-8000-0000000000a1';
const P2 = '00000000-0000-4000-8000-0000000000a2';

export function buildSeed(lang = 'he') {
  const L = (he, en) => (lang === 'he' ? he : en);
  const today = todayISO();
  const d = (n) => addDays(today, n);
  const now = new Date().toISOString();
  const mk = (rows) => rows.map((r) => ({ id: uid(), created_at: now, ...r }));

  const W = [
    [L('יוסי כהן', 'Yossi Cohen'), L('מנהל עבודה', 'Foreman'), 950],
    [L('משה לוי', 'Moshe Levi'), L('טפסן', 'Formwork carpenter'), 720],
    [L('אחמד חסן', 'Ahmed Hassan'), L('ברזלן', 'Rebar fixer'), 700],
    [L('דוד מזרחי', 'David Mizrahi'), L('מפעיל עגורן', 'Crane operator'), 880],
    [L('קרלוס ריבס', 'Carlos Rivas'), L('בטונאי', 'Concrete finisher'), 680],
    [L('ניר שגב', 'Nir Segev'), L('חשמלאי', 'Electrician'), 820],
    [L('עמיר נסאר', 'Amir Nassar'), L('אינסטלטור', 'Plumber'), 800],
    [L('סמיר עודה', 'Samir Odeh'), L('פועל בניין', 'Laborer'), 520],
    [L('דניאל פרץ', 'Daniel Peretz'), L('ממונה בטיחות', 'Safety officer'), 900],
    [L('אלי ביטון', 'Eli Biton'), L('רצף', 'Tiler'), 690],
  ];
  const companies = [L('צוות החברה', 'In-house'), L('שלד בע״מ', 'Sheled Ltd'), L('א.נ. מערכות', 'A.N. Systems')];
  const workers = mk(
    W.map(([name, role, daily_rate], i) => ({
      name,
      role,
      daily_rate,
      company: companies[i === 5 || i === 6 ? 2 : i % 3 === 1 ? 1 : 0],
      phone: `05${(i % 5) + 0}-${String(5550100 + i * 137).slice(0, 7)}`,
      email: '',
      id_number: String(300145820 + i * 7919),
      hourly_rate: Math.round(daily_rate / 9),
      start_date: d(-130 + i * 6),
      emergency_contact: '',
      notes: '',
      user_id: i === 0 ? USER_IDS.foreman : i === 1 ? USER_IDS.worker : null,
      active: true,
    }))
  );
  const wn = (i) => workers[i].name;

  const tasks = mk(
    [
      [L('עבודות עפר וחפירה', 'Earthworks & excavation'), 'חוץ', 'done', 100, -130, -115, 3200, [1, 2]],
      [L('יסודות ורצפת קרקע', 'Foundations & ground slab'), 'קרקע', 'done', 100, -114, -94, 4500, [0, 3]],
      [L('עמודים ושלד קומה א', 'Columns & frame — floor 1'), 'א', 'done', 100, -93, -79, 5100, [4, 2]],
      [L('תקרה קומה א', 'Slab — floor 1'), 'א', 'done', 100, -78, -66, 4800, [1, 7]],
      [L('עמודים ושלד קומה ב', 'Columns & frame — floor 2'), 'ב', 'done', 100, -65, -48, 5100, [0, 2]],
      [L('תקרה קומה ב', 'Slab — floor 2'), 'ב', 'done', 100, -47, -30, 4800, [1, 4]],
      [L('עמודים ושלד קומה ג', 'Columns & frame — floor 3'), 'ג', 'active', 75, -20, 3, 5100, [0, 2, 4], L('בטון מוזמן ליום חמישי', 'Concrete booked for Thursday')],
      [L('תקרה קומה ג', 'Slab — floor 3'), 'ג', 'active', 15, -2, 16, 4800, [1, 7]],
      [L('חשמל ואינסטלציה', 'Electrical & plumbing rough-in'), 'ב', 'delayed', 60, -40, -5, 2800, [5, 6], L('קבלן משנה — עיכוב בחומרים', 'Subcontractor — materials delayed')],
      [L('קירות חוץ ובידוד', 'Exterior walls & insulation'), 'חוץ', 'pending', 0, 10, 40, 3900, []],
      [L('גמר פנימי קומות', 'Interior finishes'), 'א', 'pending', 0, 41, 85, 6200, []],
      [L('עבודות חוץ ופיתוח', 'Landscaping & site development'), 'חוץ', 'pending', 0, 86, 125, 3500, []],
    ].map(([name, floor, status, progress, s, e, daily_cost, w, notes = ''], i) => ({
      name,
      floor,
      status,
      progress,
      start_date: d(s),
      end_date: d(e),
      daily_cost,
      workers: w.map(wn),
      notes,
      position: i + 1,
    }))
  );

  // Attendance for the last 14 working days.
  const attendance = [];
  for (let back = 13; back >= 0; back--) {
    const date = d(-back);
    if (parseISO(date).getDay() === 6) continue;
    workers.forEach((w, i) => {
      const r = (i * 7 + back * 13) % 17;
      let status = 'present';
      if (r === 3) status = 'absent';
      else if (r === 11) status = 'sick';
      else if (r === 15) status = 'leave';
      attendance.push({
        worker_id: w.id,
        date,
        status,
        hours: status === 'present' ? (r % 5 === 0 ? 10 : 9) : 0,
      });
    });
  }

  const logs = mk(
    [
      [0, 'sunny', 24, L('יציקת עמודים ציר 4–7 בקומה ג. הרכבת טפסנות לתקרה בחלק המזרחי.', 'Poured columns on grid 4–7, floor 3. Slab formwork set on the east wing.'), ''],
      [-1, 'cloudy', 21, L('קשירת ברזל לעמודים, פירוק טפסנות קומה ב. קבלת משלוח ברזל 12 טון.', 'Column rebar tied, floor 2 formwork stripped. Received 12 t rebar delivery.'), ''],
      [-2, 'rain', 17, L('עבודות פנים בלבד — צנרת חשמל בקומה ב.', 'Interior work only — electrical conduits on floor 2.'), L('גשם — עבודות עגורן הופסקו ב-11:30', 'Rain — crane work stopped at 11:30')],
      [-3, 'sunny', 23, L('השלמת טפסנות עמודים קומה ג, בדיקת מהנדס לזיון.', 'Completed column formwork on floor 3; engineer rebar inspection passed.'), ''],
    ]
      .filter(([o]) => parseISO(d(o)).getDay() !== 6)
      .map(([o, weather, temp, summary, delays]) => ({
        date: d(o),
        weather,
        temp,
        crew_count: attendance.filter((a) => a.date === d(o) && a.status === 'present').length,
        summary,
        delays,
        author: wn(0),
        photos: [],
      }))
  );

  const budget_lines = mk([
    { category: 'materials', planned: 1400000 },
    { category: 'labor', planned: 1100000 },
    { category: 'equipment', planned: 450000 },
    { category: 'subcontractors', planned: 800000 },
    { category: 'permits', planned: 120000 },
    { category: 'other', planned: 130000 },
  ]);

  const expenses = mk(
    [
      [-124, 'permits', L('אגרות והיתר בנייה', 'Building permit & fees'), L('עירייה', 'Municipality'), 96000, 'paid'],
      [-120, 'equipment', L('חפירה ופינוי עפר', 'Excavation & haul-off'), L('עפר הצפון', 'North Earthworks'), 118000, 'paid'],
      [-108, 'materials', L('בטון ליסודות', 'Concrete — foundations'), L('רדימיקס', 'Readymix'), 214000, 'paid'],
      [-104, 'materials', L('ברזל זיון — יסודות', 'Rebar — foundations'), L('פלדת השרון', 'Sharon Steel'), 162000, 'paid'],
      [-95, 'labor', L('שכר חודשי — חודש 1', 'Payroll — month 1'), L('צוות החברה', 'In-house'), 148000, 'paid'],
      [-88, 'equipment', L('השכרת עגורן צריח — רבעון 1', 'Tower crane rental — Q1'), L('מנופי אביב', 'Aviv Cranes'), 135000, 'paid'],
      [-74, 'materials', L('בטון ושלד קומה א', 'Concrete & frame — floor 1'), L('רדימיקס', 'Readymix'), 188000, 'paid'],
      [-65, 'labor', L('שכר חודשי — חודש 2', 'Payroll — month 2'), L('צוות החברה', 'In-house'), 156000, 'paid'],
      [-52, 'subcontractors', L('טפסנות — חשבון חלקי 1', 'Formwork — progress bill 1'), L('שלד בע״מ', 'Sheled Ltd'), 172000, 'paid'],
      [-44, 'materials', L('בטון ושלד קומה ב', 'Concrete & frame — floor 2'), L('רדימיקס', 'Readymix'), 191000, 'paid'],
      [-35, 'labor', L('שכר חודשי — חודש 3', 'Payroll — month 3'), L('צוות החברה', 'In-house'), 161000, 'paid'],
      [-28, 'equipment', L('השכרת עגורן צריח — רבעון 2', 'Tower crane rental — Q2'), L('מנופי אביב', 'Aviv Cranes'), 135000, 'paid'],
      [-21, 'subcontractors', L('חשמל ואינסטלציה — מקדמה', 'MEP rough-in — advance'), L('א.נ. מערכות', 'A.N. Systems'), 124000, 'paid'],
      [-12, 'equipment', L('פיגומים ומשאבת בטון', 'Scaffolding & concrete pump'), L('פיגומי הדרום', 'South Scaffolds'), 42000, 'pending'],
      [-6, 'materials', L('ברזל זיון — קומה ג', 'Rebar — floor 3'), L('פלדת השרון', 'Sharon Steel'), 98000, 'pending'],
      [-4, 'labor', L('שכר חודשי — חודש 4', 'Payroll — month 4'), L('צוות החברה', 'In-house'), 159000, 'pending'],
      [-2, 'other', L('שמירה וביטוח אתר', 'Site security & insurance'), L('מגן ביטוח', 'Magen Insurance'), 38000, 'paid'],
    ].map(([o, category, description, vendor, amount, status]) => ({
      date: d(o),
      category,
      description,
      vendor,
      amount,
      status,
    }))
  );

  const change_orders = mk([
    { number: 'CO-001', title: L('תוספת חניון תת-קרקעי — 4 חניות', 'Extra basement parking — 4 bays'), amount: 185000, status: 'approved', date: d(-90) },
    { number: 'CO-002', title: L('שדרוג חיפוי חזית לאבן', 'Façade cladding upgrade to stone'), amount: 96000, status: 'pending', date: d(-9) },
    { number: 'CO-003', title: L('ביטול מחסן גג', 'Remove rooftop storage room'), amount: -42000, status: 'approved', date: d(-30) },
  ]);

  const issues = mk(
    [
      ['punch', L('סדק נימי בעמוד C4', 'Hairline crack in column C4'), L('לבדיקת מהנדס קונסטרוקציה לפני המשך עבודה.', 'Needs structural engineer review before proceeding.'), 'ב', 0, 'high', 'open', 2],
      ['punch', L('ניקוז מרפסת לא בשיפוע', 'Balcony drain slope incorrect'), L('מים עומדים לאחר גשם.', 'Standing water after rain.'), 'א', 6, 'medium', 'in_progress', 5],
      ['rfi', L('הבהרה — מיקום פיר מעלית', 'Clarification — elevator shaft position'), L('אי התאמה בין תכנית אדריכלות לקונסטרוקציה, גיליון A-12.', 'Mismatch between architectural and structural drawings, sheet A-12.'), 'קרקע', 0, 'high', 'open', -1],
      ['punch', L('שרוולים חסרים בתקרה', 'Missing sleeves in slab'), L('3 שרוולי אינסטלציה חסרים בציר 5.', '3 plumbing sleeves missing on grid 5.'), 'ב', 6, 'high', 'in_progress', 1],
      ['rfi', L('סוג בידוד לקירות חוץ', 'Exterior wall insulation type'), L('נדרש אישור יועץ תרמי לחלופה.', 'Thermal consultant approval required for the alternative.'), 'חוץ', 8, 'low', 'open', 12],
      ['punch', L('מעקה זמני רופף בחדר מדרגות', 'Loose temporary railing in stairwell'), '', 'א', 8, 'high', 'done', -6],
      ['punch', L('כיסוי בטון לא מספק בקורה', 'Insufficient concrete cover on beam'), '', 'א', 4, 'medium', 'done', -20],
    ].map(([type, title, description, floor, a, priority, status, due]) => ({
      type,
      title,
      description,
      floor,
      assignee: wn(a),
      priority,
      status,
      due_date: d(due),
      photo: '',
    }))
  );

  const CHECK_OK = { ppe: true, scaffolding: true, fall: true, electrical: true, housekeeping: true, fire: true };
  const safety = mk(
    [
      ['inspection', -1, L('סיור בטיחות שבועי', 'Weekly safety walk'), L('נמצא מעקה חסר בקצה תקרה קומה ג — תוקן במקום.', 'Missing edge guardrail on floor 3 slab — fixed on the spot.'), 'low', 'closed', { ...CHECK_OK, fall: false }],
      ['toolbox', -3, L('תדריך בוקר — עבודה בגובה', 'Toolbox talk — working at height'), L('10 משתתפים.', '10 attendees.'), 'low', 'closed', null],
      ['inspection', -8, L('בדיקת פיגומים חודשית', 'Monthly scaffold inspection'), '', 'low', 'closed', CHECK_OK],
      ['near_miss', -23, L('נפילת חפץ מקומה ב', 'Dropped object from floor 2'), L('פטיש נפל לאזור מגודר. אין נפגעים. הוספו רשתות.', 'Hammer fell into a fenced zone. No injuries. Debris nets added.'), 'medium', 'closed', null],
      ['incident', -41, L('חתך ביד — עובד ברזל', 'Hand laceration — rebar worker'), L('טופל במקום, חזר לעבודה למחרת.', 'Treated on site, returned to work the next day.'), 'low', 'closed', null],
      ['hazard', -1, L('כבל חשמל חשוף ליד מערבל', 'Exposed power cable near mixer'), L('יש להחליף כבל ולהתקין מגן.', 'Replace the cable and install a guard.'), 'high', 'open', null],
    ].map(([type, o, title, description, severity, status, checklist]) => ({
      type,
      date: d(o),
      title,
      description,
      severity,
      status,
      reporter: wn(8),
      checklist,
    }))
  );

  const materials = mk(
    [
      [L('בטון ב-30', 'Concrete B-30'), L('מ״ק', 'm³'), 0, 40, L('רדימיקס', 'Readymix'), L('אספקה ישירה', 'Direct pour'), 2],
      [L('ברזל זיון 12 מ״מ', 'Rebar 12 mm'), L('טון', 't'), 14, 8, L('פלדת השרון', 'Sharon Steel'), L('מגרש צפוני', 'North yard'), null],
      [L('ברזל זיון 16 מ״מ', 'Rebar 16 mm'), L('טון', 't'), 5, 6, L('פלדת השרון', 'Sharon Steel'), L('מגרש צפוני', 'North yard'), 4],
      [L('בלוקים 20 ס״מ', 'Blocks 20 cm'), L('יח׳', 'pcs'), 4200, 1500, L('אקרשטיין', 'Ackerstein'), L('מגרש מערבי', 'West yard'), null],
      [L('לוחות טפסנות', 'Formwork panels'), L('יח׳', 'pcs'), 180, 120, L('שלד בע״מ', 'Sheled Ltd'), L('קומה ג', 'Floor 3'), null],
      [L('צמנט אפור', 'Grey cement'), L('שק', 'bags'), 60, 100, L('נשר', 'Nesher'), L('מחסן', 'Storage'), 1],
      [L('צנרת חשמל 20 מ״מ', 'Electrical conduit 20 mm'), L('מ׳', 'm'), 850, 400, L('א.נ. מערכות', 'A.N. Systems'), L('מחסן', 'Storage'), null],
      [L('קסדות ואפודים', 'Helmets & vests'), L('סט', 'sets'), 6, 10, L('מגן ציוד', 'Magen Gear'), L('משרד אתר', 'Site office'), 6],
    ].map(([name, unit, qty, min_qty, supplier, location, del]) => ({
      name,
      unit,
      qty,
      min_qty,
      supplier,
      location,
      next_delivery: del == null ? null : d(del),
    }))
  );

  const users = [
    { id: USER_IDS.manager, name: L('דנה אלון', 'Dana Alon'), email: 'manager@demo.site', role: 'manager', created_at: now },
    { id: USER_IDS.foreman, name: wn(0), email: 'foreman@demo.site', role: 'foreman', created_at: now },
    { id: USER_IDS.worker, name: wn(1), email: 'worker@demo.site', role: 'worker', created_at: now },
  ];

  const positions = mk(
    [...new Map(W.map(([, role, rate]) => [role, rate])).entries()].map(([name, rate]) => ({
      name,
      hourly_rate: Math.round(rate / 9),
    }))
  );

  const projects = [
    {
      id: P1,
      created_at: now,
      name: L('מגדלי הפארק — בניין B', 'Park Towers — Building B'),
      address: L('רחוב הזית 14, חיפה', '14 HaZayit St, Haifa'),
      client: L('אלון נדל״ן בע״מ', 'Alon Real Estate Ltd'),
      manager: users[0].name,
      start_date: d(-130),
      end_date: d(125),
      currency: '₪',
      wallpaper: 'ocean',
      accent: 'blue',
    },
    {
      id: P2,
      created_at: now,
      name: L('שיפוץ בית ספר אורנים', 'Oranim School Renovation'),
      address: L('דרך האורן 3, קריית טבעון', '3 HaOren Rd, Kiryat Tivon'),
      client: L('מועצה מקומית טבעון', 'Tivon Local Council'),
      manager: users[0].name,
      start_date: d(-30),
      end_date: d(90),
      currency: '₪',
      wallpaper: 'sunset',
      accent: 'orange',
    },
  ];

  const scope = (pid, rows) => rows.map((r) => ({ ...r, project_id: pid }));

  // A second, smaller project so the multi-project desktop has something to show.
  const w2 = mk(
    [
      [L('רון אביטל', 'Ron Avital'), L('מנהל עבודה', 'Foreman'), 920],
      [L('חאלד מנסור', 'Khaled Mansour'), L('רצף', 'Tiler'), 690],
      [L('איגור לבין', 'Igor Levin'), L('חשמלאי', 'Electrician'), 820],
      [L('תומר דהן', 'Tomer Dahan'), L('פועל בניין', 'Laborer'), 520],
    ].map(([name, role, daily_rate], i) => ({
      name, role, daily_rate, company: companies[0], phone: `05${i + 2}-66601${i}7`, email: '', id_number: String(311204567 + i * 6131),
      hourly_rate: Math.round(daily_rate / 9), start_date: d(-30), emergency_contact: '', notes: '', user_id: null, active: true,
    }))
  );
  const t2 = mk(
    [
      [L('פירוק והריסה', 'Demolition & strip-out'), 'קרקע', 'done', 100, -30, -16, 2600, [0, 3]],
      [L('החלפת תשתיות חשמל', 'Electrical rewiring'), 'א', 'active', 55, -15, 12, 3100, [2]],
      [L('ריצוף כיתות', 'Classroom flooring'), 'א', 'active', 20, -4, 24, 2900, [1, 3]],
      [L('צבע וגמרים', 'Painting & finishes'), 'א', 'pending', 0, 25, 60, 2400, []],
      [L('חצר ופיתוח', 'Yard & landscaping'), 'חוץ', 'pending', 0, 61, 90, 2200, []],
    ].map(([name, floor, status, progress, s0, e0, daily_cost, w], i) => ({
      name, floor, status, progress, start_date: d(s0), end_date: d(e0), daily_cost, workers: w.map((k) => w2[k].name), notes: '', position: i + 1,
    }))
  );
  const a2 = [];
  for (let back = 6; back >= 0; back--) {
    const date = d(-back);
    if (parseISO(date).getDay() === 6) continue;
    w2.forEach((w, i) => a2.push({ worker_id: w.id, date, status: (i + back) % 6 === 5 ? 'absent' : 'present', hours: (i + back) % 6 === 5 ? 0 : 9 }));
  }
  const b2 = mk([
    { category: 'materials', planned: 260000 },
    { category: 'labor', planned: 310000 },
    { category: 'equipment', planned: 60000 },
    { category: 'subcontractors', planned: 90000 },
  ]);
  const e2 = mk([
    { date: d(-26), category: 'equipment', description: L('מכולות פינוי פסולת', 'Waste skips'), vendor: L('פינוי הצפון', 'North Haulage'), amount: 18000, status: 'paid' },
    { date: d(-14), category: 'materials', description: L('כבלים ולוחות חשמל', 'Cables & panels'), vendor: L('חשמל ישיר', 'Hashmal Yashir'), amount: 64000, status: 'paid' },
    { date: d(-5), category: 'labor', description: L('שכר — חודש 1', 'Payroll — month 1'), vendor: L('צוות החברה', 'In-house'), amount: 82000, status: 'paid' },
    { date: d(-2), category: 'materials', description: L('אריחי גרניט פורצלן', 'Porcelain tiles'), vendor: L('נגב קרמיקה', 'Negev Ceramics'), amount: 47000, status: 'pending' },
  ]);

  return {
    users,
    positions,
    projects,
    tasks: [...scope(P1, tasks), ...scope(P2, t2)],
    workers: [...scope(P1, workers), ...scope(P2, w2)],
    attendance: [...scope(P1, mk(attendance)), ...scope(P2, mk(a2))],
    logs: scope(P1, logs),
    expenses: [...scope(P1, expenses), ...scope(P2, e2)],
    budget_lines: [...scope(P1, budget_lines), ...scope(P2, b2)],
    change_orders: scope(P1, change_orders),
    issues: scope(P1, issues),
    safety: scope(P1, safety),
    materials: scope(P1, materials),
  };
}
