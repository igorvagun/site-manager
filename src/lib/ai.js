import { supabase } from './supabase';
import { getState } from './store';

// AI features run through the Supabase Edge Function "ai" (supabase/functions/ai),
// which holds the Claude API key server-side. Without cloud mode they are unavailable.
export const aiAvailable = () => getState().mode === 'cloud' && !!supabase;

export async function aiCall(action, payload) {
  if (!aiAvailable()) throw new Error('ai_unavailable');
  const { data, error } = await supabase.functions.invoke('ai', { body: { action, ...payload } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
