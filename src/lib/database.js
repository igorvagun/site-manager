import { supabase } from './supabase';

export async function getTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }

  return data || [];
}

export async function addTask(task) {
  const { data: countData } = await supabase
    .from('tasks')
    .select('position', { count: 'exact' });

  const nextPosition = (countData?.length || 0) + 1;

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      name: task.name,
      floor: task.floor,
      status: task.status,
      progress: task.progress || 0,
      start_date: task.startDate,
      end_date: task.endDate,
      daily_cost: task.dailyCost || 0,
      workers: task.workers || [],
      notes: task.notes || '',
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding task:', error);
    return null;
  }

  return data;
}

export async function updateTask(id, patch) {
  const updates = {};

  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.floor !== undefined) updates.floor = patch.floor;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.progress !== undefined) updates.progress = patch.progress;
  if (patch.startDate !== undefined) updates.start_date = patch.startDate;
  if (patch.endDate !== undefined) updates.end_date = patch.endDate;
  if (patch.dailyCost !== undefined) updates.daily_cost = patch.dailyCost;
  if (patch.workers !== undefined) updates.workers = patch.workers;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.position !== undefined) updates.position = patch.position;

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    return null;
  }

  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);

  if (error) {
    console.error('Error deleting task:', error);
    return false;
  }

  return true;
}

export function subscribeToTasks(callback) {
  const subscription = supabase
    .from('tasks')
    .on('*', (payload) => {
      callback(payload);
    })
    .subscribe();

  return () => {
    supabase.removeSubscription(subscription);
  };
}
