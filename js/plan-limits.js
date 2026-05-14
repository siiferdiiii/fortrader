/* ========================================
   PLAN-LIMITS.JS — Feature Gating by Plan
   ======================================== */

const PlanLimits = {

    /** Limits per plan */
    LIMITS: {
        free: {
            maxSessions: 3,
            maxJournal: 10,
            maxMethods: 2,
            exportCSV: false,
            aiAnalysis: false,
            realChart: false,
        },
        basic: {
            maxSessions: Infinity,
            maxJournal: Infinity,
            maxMethods: 10,
            exportCSV: true,
            aiAnalysis: false,
            realChart: false,
        },
        pro: {
            maxSessions: Infinity,
            maxJournal: Infinity,
            maxMethods: Infinity,
            exportCSV: true,
            aiAnalysis: true,
            realChart: true,
        }
    },

    /** Get current user plan */
    getPlan() {
        if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.currentUser) {
            return Auth.currentUser.plan || 'free';
        }
        return 'free';
    },

    /** Get limits for current plan */
    getLimits() {
        return this.LIMITS[this.getPlan()] || this.LIMITS.free;
    },

    /**
     * Check if a feature/action is allowed
     * @param {'session'|'journal'|'method'|'exportCSV'|'aiAnalysis'} feature
     * @returns {{allowed: boolean, message: string}}
     */
    check(feature) {
        const plan = this.getPlan();
        const limits = this.getLimits();

        switch (feature) {
            case 'session': {
                const count = Storage.getSessions().length;
                const active = Storage.getActiveSession() ? 1 : 0;
                const total = count + active;
                if (total >= limits.maxSessions) {
                    return {
                        allowed: false,
                        message: `Plan ${plan.toUpperCase()} hanya bisa menyimpan ${limits.maxSessions} sesi backtest. Upgrade untuk unlimited!`
                    };
                }
                return { allowed: true, message: '' };
            }

            case 'journal': {
                const count = Storage.getJournal().length;
                if (count >= limits.maxJournal) {
                    return {
                        allowed: false,
                        message: `Plan ${plan.toUpperCase()} hanya bisa menyimpan ${limits.maxJournal} jurnal entry. Upgrade untuk unlimited!`
                    };
                }
                return { allowed: true, message: '' };
            }

            case 'method': {
                const count = Storage.getMethods().length;
                if (count >= limits.maxMethods) {
                    return {
                        allowed: false,
                        message: `Plan ${plan.toUpperCase()} hanya bisa menyimpan ${limits.maxMethods} metode trading. Upgrade untuk menambah lebih banyak!`
                    };
                }
                return { allowed: true, message: '' };
            }

            case 'exportCSV': {
                if (!limits.exportCSV) {
                    return {
                        allowed: false,
                        message: 'Export CSV tersedia untuk plan Basic dan Pro. Upgrade sekarang!'
                    };
                }
                return { allowed: true, message: '' };
            }

            case 'aiAnalysis': {
                if (!limits.aiAnalysis) {
                    return {
                        allowed: false,
                        message: 'AI Analisa Jam Trading tersedia untuk plan Pro. Upgrade sekarang!'
                    };
                }
                return { allowed: true, message: '' };
            }

            case 'realChart': {
                if (!limits.realChart) {
                    return {
                        allowed: false,
                        message: 'Real Chart TradingView eksklusif untuk pengguna Pro. Upgrade sekarang untuk experience maksimal!'
                    };
                }
                return { allowed: true, message: '' };
            }

            default:
                return { allowed: true, message: '' };
        }
    }
};
