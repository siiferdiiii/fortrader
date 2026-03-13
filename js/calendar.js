/* ========================================
   CALENDAR.JS – Economic Calendar & News Service
   ======================================== */

const Calendar = {
    // Using a public JSON feed (Forex Factory calendar format)
    // On Vercel we use our custom serverless API to bypass rate limit blocks, locally we use proxy
    API_URL: window.location.protocol === 'file:' ? 'https://api.allorigins.win/get?url=https%3A%2F%2Fnfs.faireconomy.media%2Fff_calendar_thisweek.json' : '/api/calendar',

    // Cache duration: 4 hours (in milliseconds)
    CACHE_DURATION: 4 * 60 * 60 * 1000,

    // Impact mapping for UI colors
    IMPACT_LEVELS: {
        'High': 'high',
        'Medium': 'medium',
        'Low': 'low',
        'None': 'none'
    },

    init() {
        this.cacheDOM();
        this.bindEvents();
        // We do not auto-fetch on init to save API calls unless the user navigates to the page
        // Wait until Calendar.render() or Calendar.checkUpcomingNews() is called
    },

    cacheDOM() {
        this.listEl = document.getElementById('calendar-list');
        this.filterHighImpact = document.getElementById('calendar-filter-high');
        this.btnRefresh = document.getElementById('btn-refresh-calendar');
        this.lastUpdateEl = document.getElementById('calendar-last-update');
    },

    bindEvents() {
        if (this.filterHighImpact) {
            this.filterHighImpact.addEventListener('change', () => this.render());
        }
        if (this.btnRefresh) {
            this.btnRefresh.addEventListener('click', () => {
                this.fetchData(true).then(() => this.render());
            });
        }
    },

    /**
     * Fetch calendar data from FMP API.
     * Uses localStorage caching to prevent hitting rate limits.
     * @param {boolean} forceRefresh - If true, ignores cache and fetches fresh data
     */
    async fetchData(forceRefresh = false) {
        const cached = Storage.getCalendarData();
        const now = Date.now();

        // Use cache if available, not forced, and not expired
        if (!forceRefresh && cached && cached.events && (now - cached.timestamp < this.CACHE_DURATION)) {
            this.events = cached.events;
            this._updateLastRefreshedTime(cached.timestamp);
            return this.events;
        }

        this._setLoadingState(true);

        try {
            // Fetch data for the current week from the public JSON feed
            const response = await fetch(this.API_URL);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            let data = await response.json();

            // Handle allorigins.win /get wrapper
            if (data && data.contents) {
                try {
                    data = JSON.parse(data.contents);
                } catch (e) {
                    throw new Error("Gagal parsing JSON dari proxy");
                }
            }

            // FMP API usually returns an array of objects
            if (Array.isArray(data)) {
                // Sort by date ascending
                this.events = data.sort((a, b) => new Date(a.date) - new Date(b.date));
                Storage.saveCalendarData(this.events);
                this._updateLastRefreshedTime(now);
                App.showToast('Data Kalender Ekonomi berhasil diperbarui', 'success');
            } else {
                console.error("Unexpected API response format:", data);
                App.showToast('Gagal memproses data kalender', 'error');
                this.events = [];
            }
        } catch (error) {
            console.error('Error fetching calendar data:', error);
            App.showToast('Gagal mengambil data kalender. Cek koneksi Anda.', 'error');
            // Fallback to cache if available
            if (cached && cached.events) {
                this.events = cached.events;
            } else {
                this.events = [];
            }
        } finally {
            this._setLoadingState(false);
        }

        return this.events;
    },

    /**
     * Renders the calendar data to the UI table/list
     */
    async render() {
        if (!this.listEl) return;

        // Fetch data if not already loaded in memory
        if (!this.events) {
            await this.fetchData();
        }

        let filteredEvents = this.events || [];

        // Apply filters
        const filterEl = document.getElementById('calendar-filter-high');
        const onlyHighImpact = filterEl && filterEl.checked;
        if (onlyHighImpact) {
            filteredEvents = filteredEvents.filter(e => e.impact === 'High');
        }

        // Also filter out past events (older than 1 day) to keep the list clean
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        filteredEvents = filteredEvents.filter(e => new Date(e.date) >= oneDayAgo);

        this.listEl.innerHTML = '';

        if (filteredEvents.length === 0) {
            this.listEl.innerHTML = `
                <div class="empty-state" style="margin-top: var(--space-2xl);">
                    <div class="empty-state__icon">🗓️</div>
                    <div class="empty-state__text">Tidak ada jadwal rilis berita ekonomi yang ditemukan.</div>
                </div>`;
            return;
        }

        // Group events by date (YYYY-MM-DD)
        const grouped = {};
        for (const event of filteredEvents) {
            const d = new Date(event.date);
            const dateStr = d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (!grouped[dateStr]) grouped[dateStr] = [];
            grouped[dateStr].push(event);
        }

        for (const [dateStr, events] of Object.entries(grouped)) {
            // Create Date Header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'calendar-date-header';
            dateHeader.textContent = dateStr;
            this.listEl.appendChild(dateHeader);

            // Create Event Rows
            for (const event of events) {
                const row = this._buildEventRow(event);
                this.listEl.appendChild(row);
            }
        }
    },

    _buildEventRow(event) {
        const d = new Date(event.date);
        const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const impactClass = this.IMPACT_LEVELS[event.impact] || 'none';

        const row = document.createElement('div');
        row.className = `calendar-event impact-${impactClass}`;

        const actual = (event.actual !== undefined && event.actual !== null && event.actual !== '') ? event.actual : '-';
        const estimate = (event.forecast !== undefined && event.forecast !== null && event.forecast !== '') ? event.forecast : '-';
        const previous = (event.previous !== undefined && event.previous !== null && event.previous !== '') ? event.previous : '-';

        row.innerHTML = `
            <div class="calendar-event__time">${timeStr}</div>
            <div class="calendar-event__currency">
                <span class="currency-flag currency-${event.country.toLowerCase()}"></span>
                ${event.country}
            </div>
            <div class="calendar-event__impact">
                <span class="impact-indicator"></span>
            </div>
            <div class="calendar-event__details">
                <div class="calendar-event__title">${this._escHtml(event.title)}</div>
            </div>
            <div class="calendar-event__stats">
                <div class="stat-col"><span class="stat-label">Aktual</span><span class="stat-val actual">${actual}</span></div>
                <div class="stat-col"><span class="stat-label">Prediksi</span><span class="stat-val">${estimate}</span></div>
                <div class="stat-col"><span class="stat-label">Sblmnya</span><span class="stat-val">${previous}</span></div>
            </div>
        `;
        return row;
    },

    _setLoadingState(isLoading) {
        if (!this.listEl) return;
        if (isLoading) {
            this.listEl.innerHTML = `
                <div class="calendar-loading">
                    <svg class="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    <span>Mengambil data kalender...</span>
                </div>
            `;
        }
    },

    _updateLastRefreshedTime(timestamp) {
        if (!this.lastUpdateEl) return;
        const d = new Date(timestamp);
        this.lastUpdateEl.textContent = `Terakhir diperbarui: ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    },

    /**
     * Checks if there are high impact news for the given pair currencies near the openTime.
     * Used by the Trade Calculator to warn users.
     * @param {string} pair - e.g., "XAUUSD" or "EURUSD"
     * @param {string} openTimeStr - HH:MM string representing today's open time
     * @returns {Array} Array of warning messages/events found
     */
    async checkUpcomingNews(pair, openTimeStr) {
        // Only run check if we can parse the pair
        if (!pair || pair.length < 6) return [];

        // Ensure data is loaded
        if (!this.events) {
            await this.fetchData();
        }
        if (!this.events) return [];

        const baseCurrency = pair.substring(0, 3);
        const quoteCurrency = pair.substring(3, 6);
        const relevantCurrencies = [baseCurrency, quoteCurrency];

        // Special case for Gold and Indices
        if (baseCurrency === 'XAU') relevantCurrencies.push('USD');
        if (pair === 'US30' || pair === 'NAS100') relevantCurrencies.push('USD');

        // Construct a Date object for today with the given openTime
        const now = new Date();
        const [hours, minutes] = openTimeStr.split(':').map(Number);
        const tradeTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

        const warnings = [];
        const THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours before/after

        for (const event of this.events) {
            // Only care about High Impact
            if (event.impact !== 'High') continue;
            // Only care about relevant currencies
            if (!relevantCurrencies.includes(event.country)) continue;

            const eventTime = new Date(event.date);

            // Allow checking events happening today only
            if (eventTime.getDate() !== tradeTime.getDate() || eventTime.getMonth() !== tradeTime.getMonth()) {
                continue;
            }

            const diff = Math.abs(eventTime - tradeTime);
            if (diff <= THRESHOLD_MS) {
                warnings.push(event);
            }
        }

        return warnings;
    },

    _escHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
};
