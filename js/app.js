/* ========================================
   APP.JS - SPA Routing & Initialization
   ======================================== */

const App = {
    currentPage: 'backtest',

    // Page labels for topbar
    pageLabels: {
        dashboard: '📊 Dashboard',
        backtest: '⚡ Backtest',
        sessions: '🗂️ Sesi Backtest',
        methods: '📋 Metode Trading',
        calculator: '🧮 Kalkulator Trade',
        journal: '📓 Jurnal Trade',
        login: '🔐 Masuk',
        register: '📝 Daftar',
        account: '👤 Akun Saya',
    },

    init() {
        this.cacheDOM();
        this.bindEvents();

        // Initialize modules
        Methods.init();
        Charts.init();
        Backtest.init();
        Sessions.init();
        Calculator.init();
        Journal.init();
        Dashboard.init();
        Auth.init();

        // Wire popup cancel btn
        const cancelBtn = document.getElementById('calc-popup-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => Calculator.closePopup());

        // Set initial page — require login
        if (Auth.isLoggedIn) {
            this.navigateTo('dashboard');
        } else {
            this.navigateTo('login');
        }
    },

    cacheDOM() {
        this.navLinks = document.querySelectorAll('.sidebar__link');
        this.pageViews = document.querySelectorAll('.page-view');
        this.sidebar = document.getElementById('sidebar');
        this.overlay = document.getElementById('sidebar-overlay');
        this.hamburgerBtn = document.getElementById('hamburger-btn');
        this.closeBtn = document.getElementById('sidebar-close');
        this.topbarLabel = document.getElementById('topbar-page-label');
    },

    bindEvents() {
        // Nav links → navigate + close sidebar
        this.navLinks.forEach(link => {
            link.addEventListener('click', () => {
                const page = link.dataset.page;
                this.navigateTo(page);
                this.closeSidebar();
            });
        });

        // Hamburger → open sidebar
        this.hamburgerBtn.addEventListener('click', () => this.openSidebar());

        // Close button → close sidebar
        this.closeBtn.addEventListener('click', () => this.closeSidebar());

        // Overlay click → close sidebar
        this.overlay.addEventListener('click', () => this.closeSidebar());

        // Keyboard ESC → close sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeSidebar();
        });
    },

    openSidebar() {
        this.sidebar.classList.add('open');
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeSidebar() {
        this.sidebar.classList.remove('open');
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    },

    navigateTo(page) {
        // Auth gate — block access if not logged in
        const publicPages = ['login', 'register'];
        if (!Auth.isLoggedIn && !publicPages.includes(page)) {
            page = 'login';
        }

        this.currentPage = page;

        // Update sidebar nav links
        this.navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.page === page);
        });

        // Update page views
        this.pageViews.forEach(view => {
            view.classList.toggle('active', view.id === `page-${page}`);
        });

        // Update topbar page label
        if (this.topbarLabel) {
            this.topbarLabel.textContent = this.pageLabels[page] || page;
        }

        // Hide fixed TP/SL action bar when leaving backtest
        const fixedBar = document.getElementById('fixed-action-bar');
        if (fixedBar && page !== 'backtest') {
            fixedBar.style.display = 'none';
        }

        // Page-specific actions
        if (page === 'backtest' && Charts.equityChart) {
            setTimeout(() => Charts.equityChart.resize(), 50);
        }
        if (page === 'sessions') {
            Sessions.render();
        }
        if (page === 'calculator') {
            Calculator.refresh();
        }
        if (page === 'journal') {
            Journal.render();
        }
        if (page === 'dashboard') {
            Dashboard.render();
        }
        if (page === 'account') {
            Auth.renderAccount();
        }
    },

    /**
     * Show a toast notification
     * @param {string} message
     * @param {'success'|'error'} type
     */
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        // Remove after animation
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
};

// ====== Boot ======
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
