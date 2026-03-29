import { useState, useCallback, useEffect, useMemo } from 'react';
import Header from './Header';
import TaskTable from './TaskTable';
import AddTaskModal from './AddTaskModal';
import { STATUS_OPTIONS, FLOOR_OPTIONS, workingDays, fmtMoney } from '../lib/utils';
import { getTasks, addTask, updateTask, deleteTask, subscribeToTasks } from '../lib/database';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFloor, setFilterFloor] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const data = await getTasks();
        setTasks(data);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();

    const unsubscribe = subscribeToTasks((payload) => {
      if (payload.eventType === 'INSERT') {
        setTasks((prevTasks) => [...prevTasks, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setTasks((prevTasks) =>
          prevTasks.map((t) => (t.id === payload.new.id ? payload.new : t))
        );
      } else if (payload.eventType === 'DELETE') {
        setTasks((prevTasks) => prevTasks.filter((t) => t.id !== payload.old.id));
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const update = useCallback(async (id, patch) => {
    const updatedPatch = { ...patch };
    if (patch.progress === 100) {
      updatedPatch.status = 'done';
    }

    try {
      await updateTask(id, updatedPatch);
      setTasks((ts) =>
        ts.map((t) => {
          if (t.id !== id) return t;
          const u = { ...t };
          if (updatedPatch.name !== undefined) u.name = updatedPatch.name;
          if (updatedPatch.status !== undefined) u.status = updatedPatch.status;
          if (updatedPatch.progress !== undefined) u.progress = updatedPatch.progress;
          if (updatedPatch.workers !== undefined) u.workers = updatedPatch.workers;
          if (updatedPatch.notes !== undefined) u.notes = updatedPatch.notes;
          if (updatedPatch.floor !== undefined) u.floor = updatedPatch.floor;
          if (updatedPatch.start_date !== undefined) u.start_date = updatedPatch.start_date;
          if (updatedPatch.end_date !== undefined) u.end_date = updatedPatch.end_date;
          if (updatedPatch.daily_cost !== undefined) u.daily_cost = updatedPatch.daily_cost;
          return u;
        })
      );
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }, []);

  const addTaskHandler = useCallback(async (form) => {
    try {
      const newTask = await addTask(form);
      if (newTask) {
        setTasks((ts) => [...ts, newTask]);
      }
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  }, []);

  const swapPriority = useCallback(async (index, dir) => {
    setTasks((ts) => {
      const next = [...ts];
      const target = index + dir;
      if (target < 0 || target >= next.length) return ts;

      const task1 = next[index];
      const task2 = next[target];
      const temp = task1.position;
      task1.position = task2.position;
      task2.position = temp;

      [next[index], next[target]] = [next[target], next[index]];

      updateTask(task1.id, { position: task1.position });
      updateTask(task2.id, { position: task2.position });

      return next;
    });
  }, []);

  const removeTask = useCallback(async (id) => {
    try {
      await deleteTask(id);
      setTasks((ts) => ts.filter((t) => t.id !== id));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, []);

  const stats = useMemo(() => {
    const doneCount = tasks.filter((t) => t.status === 'done').length;
    const activeCount = tasks.filter((t) => t.status === 'active').length;
    const totalBudget = tasks.reduce(
      (s, t) => s + workingDays(t.start_date, t.end_date) * t.daily_cost,
      0
    );
    const activeDailyCost = tasks
      .filter((t) => t.status === 'active')
      .reduce((s, t) => s + t.daily_cost, 0);

    return {
      totalTasks: tasks.length,
      doneCount,
      activeCount,
      totalBudget,
      activeDailyCost,
    };
  }, [tasks]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
        טוען משימות...
      </div>
    );
  }

  return (
    <>
      <Header stats={stats} />

      <div className="main">
        <div className="controls">
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            ＋ משימה חדשה
          </button>
          <input
            className="ctrl-input search"
            placeholder="🔍 חיפוש משימה..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="ctrl-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">כל הסטטוסים</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className="ctrl-input"
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
          >
            <option value="">כל הקומות</option>
            {FLOOR_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {(filterStatus || filterFloor || search) && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setFilterStatus('');
                setFilterFloor('');
                setSearch('');
              }}
            >
              ✕ נקה
            </button>
          )}
        </div>

        <div className="section-title">
          {tasks.filter((t) => {
            if (filterStatus && t.status !== filterStatus) return false;
            if (filterFloor && t.floor !== filterFloor) return false;
            if (search && !t.name.includes(search)) return false;
            return true;
          }).length}{' '}
          משימות מוצגות
        </div>

        <TaskTable
          tasks={tasks}
          filterStatus={filterStatus}
          filterFloor={filterFloor}
          search={search}
          onUpdate={update}
          onDelete={removeTask}
          onSwapPriority={swapPriority}
        />
      </div>

      {showModal && <AddTaskModal onClose={() => setShowModal(false)} onAdd={addTaskHandler} />}
    </>
  );
}
