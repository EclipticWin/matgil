/**
 * Mock auth service. No real authentication — it just persists a fake user
 * to localStorage so the UI can demonstrate a logged-in state.
 *
 * Replace these with calls to Supabase Auth (or your Edge Functions) later;
 * keep the same async signatures so callers don't change.
 */
const KEY = 'matgil.user';

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function save(user) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  return user;
}

export async function login({ email }) {
  const name = email && email.includes('@') ? email.split('@')[0] : 'Traveller';
  return save({ name, email: email || 'traveller@matgil.app', provider: 'email' });
}

export async function signUp({ email }) {
  return login({ email });
}

export async function loginWithProvider(provider) {
  const labels = { google: 'Google User', facebook: 'Facebook User' };
  return save({ name: labels[provider] || 'Traveller', email: `user@${provider}.com`, provider });
}

export function logout() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
