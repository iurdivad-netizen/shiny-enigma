/**
 * Session save/load and import/export utilities.
 *
 * Supports saving simulation state (legs, parameters, sliders) to
 * localStorage slots and exporting/importing as JSON files.
 */

const STORAGE_KEY = 'options_sim_saved_sessions';
const MAX_SLOTS = 20;

/* ── Session shape ─────────────────────────────────────────── */

/**
 * Capture current simulation state into a serialisable object.
 */
export function captureSession({
  underlyingPrice, riskFreeRate, daysToExpiry, dividendYield,
  legs, timePercent, ivShift, tickerLabel, activePreset, simulationDate,
}) {
  return {
    underlyingPrice,
    riskFreeRate,
    daysToExpiry,
    dividendYield,
    legs: legs.map(({ id, ...rest }) => rest), // strip runtime ids
    timePercent,
    ivShift,
    tickerLabel,
    activePreset,
    simulationDate: simulationDate || '',
  };
}

/* ── localStorage slots ────────────────────────────────────── */

export function loadSavedSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSavedSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Save a named session to localStorage.
 * Returns the updated list.
 */
export function saveSession(name, sessionData) {
  const sessions = loadSavedSessions();
  const entry = {
    id: `sess-${Date.now()}`,
    name,
    savedAt: new Date().toISOString(),
    data: sessionData,
  };
  const updated = [entry, ...sessions].slice(0, MAX_SLOTS);
  saveSavedSessions(updated);
  return updated;
}

/**
 * Delete a saved session by id.
 */
export function deleteSavedSession(sessionId) {
  const sessions = loadSavedSessions();
  const updated = sessions.filter((s) => s.id !== sessionId);
  saveSavedSessions(updated);
  return updated;
}

/* ── JSON file export ──────────────────────────────────────── */

/**
 * Export session + optional portfolios as a JSON file download.
 */
export function exportToFile(sessionData, portfolios = null) {
  const payload = {
    version: 1,
    type: portfolios ? 'full' : 'session',
    exportedAt: new Date().toISOString(),
    session: sessionData,
  };
  if (portfolios) {
    payload.portfolios = portfolios;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const label = sessionData.tickerLabel
    ? sessionData.tickerLabel.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '')
    : 'session';
  a.download = `options-sim-${label}-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── JSON file import ──────────────────────────────────────── */

/**
 * Parse and validate an imported JSON file.
 * Returns { session, portfolios } or throws on invalid data.
 */
export function parseImportFile(jsonString) {
  const data = JSON.parse(jsonString);

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid file: not a JSON object');
  }

  // Support both wrapped format (version/type/session) and raw session
  let session = null;
  let portfolios = null;

  if (data.version && data.session) {
    session = data.session;
    portfolios = data.portfolios || null;
  } else if (data.legs && typeof data.underlyingPrice === 'number') {
    // Raw session object
    session = data;
  } else {
    throw new Error('Invalid file: missing session data');
  }

  // Validate required session fields
  if (typeof session.underlyingPrice !== 'number') {
    throw new Error('Invalid session: missing underlyingPrice');
  }
  if (!Array.isArray(session.legs)) {
    throw new Error('Invalid session: missing legs array');
  }

  // Validate each leg has required fields
  for (const leg of session.legs) {
    if (!['call', 'put'].includes(leg.type)) {
      throw new Error(`Invalid leg type: ${leg.type}`);
    }
    if (!['long', 'short'].includes(leg.direction)) {
      throw new Error(`Invalid leg direction: ${leg.direction}`);
    }
    if (typeof leg.strike !== 'number' || leg.strike < 0) {
      throw new Error(`Invalid leg strike: ${leg.strike}`);
    }
    if (typeof leg.iv !== 'number' || leg.iv < 0) {
      throw new Error(`Invalid leg IV: ${leg.iv}`);
    }
  }

  return { session, portfolios };
}
