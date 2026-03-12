/* ========================================
   STORAGE.JS - LocalStorage Helper Functions
   ======================================== */

const Storage = {
  KEYS: {
    METHODS: 'tradetest_methods',
    SESSIONS: 'tradetest_sessions',
    ACTIVE_SESSION: 'tradetest_active_session',
    JOURNAL: 'tradetest_journal',
    CALENDAR: 'tradetest_calendar',
  },

  /**
   * Get data from localStorage (parsed JSON)
   */
  get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Storage.get error:', e);
      return null;
    }
  },

  /**
   * Set data to localStorage (stringified JSON)
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage.set error:', e);
    }
  },

  /**
   * Remove a key from localStorage
   */
  remove(key) {
    localStorage.removeItem(key);
  },

  // ====== METHODS ======
  getMethods() {
    return this.get(this.KEYS.METHODS) || [];
  },

  saveMethod(method) {
    const methods = this.getMethods();
    const existing = methods.findIndex(m => m.id === method.id);
    if (existing !== -1) {
      methods[existing] = method;
    } else {
      methods.push(method);
    }
    this.set(this.KEYS.METHODS, methods);
  },

  deleteMethod(id) {
    const methods = this.getMethods().filter(m => m.id !== id);
    this.set(this.KEYS.METHODS, methods);
  },

  // ====== SESSIONS ======
  getSessions() {
    return this.get(this.KEYS.SESSIONS) || [];
  },

  saveSession(session) {
    const sessions = this.getSessions();
    const existing = sessions.findIndex(s => s.id === session.id);
    if (existing !== -1) {
      sessions[existing] = session;
    } else {
      sessions.push(session);
    }
    this.set(this.KEYS.SESSIONS, sessions);
  },

  deleteSession(id) {
    const sessions = this.getSessions().filter(s => s.id !== id);
    this.set(this.KEYS.SESSIONS, sessions);
  },

  // ====== ACTIVE SESSION (in-progress) ======
  getActiveSession() {
    return this.get(this.KEYS.ACTIVE_SESSION);
  },

  setActiveSession(session) {
    this.set(this.KEYS.ACTIVE_SESSION, session);
  },

  clearActiveSession() {
    this.remove(this.KEYS.ACTIVE_SESSION);
  },

  // ====== UTILITIES ======
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  },

  // ====== JOURNAL ======
  getJournal() {
    return this.get(this.KEYS.JOURNAL) || [];
  },

  saveJournalEntry(entry) {
    const journal = this.getJournal();
    const existing = journal.findIndex(e => e.id === entry.id);
    if (existing !== -1) {
      journal[existing] = entry;
    } else {
      journal.unshift(entry); // newest first
    }
    this.set(this.KEYS.JOURNAL, journal);
  },

  updateJournalEntry(id, updates) {
    const journal = this.getJournal();
    const idx = journal.findIndex(e => e.id === id);
    if (idx !== -1) {
      journal[idx] = { ...journal[idx], ...updates };
      this.set(this.KEYS.JOURNAL, journal);
      return journal[idx];
    }
    return null;
  },

  deleteJournalEntry(id) {
    const journal = this.getJournal().filter(e => e.id !== id);
    this.set(this.KEYS.JOURNAL, journal);
  },

  // ====== CALENDAR ======
  getCalendarData() {
    return this.get(this.KEYS.CALENDAR);
  },

  saveCalendarData(data) {
    const cache = {
      timestamp: Date.now(),
      events: data
    };
    this.set(this.KEYS.CALENDAR, cache);
  },
};
