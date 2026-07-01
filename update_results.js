const fs = require('fs');
let content = fs.readFileSync('results.html', 'utf8');

// Add tailwind config
content = content.replace('<script src="https://cdn.tailwindcss.com"></script>', `<script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {}
            }
        }
    </script>`);

// Replace styles
const newStyles = `
        :root {
            --bg-gradient-start: #f1f5f9;
            --bg-gradient-end: #e2e8f0;
            --text-main: #334155;
            --text-muted: #64748b;
            --glass-bg: rgba(255, 255, 255, 0.45);
            --glass-border: rgba(0, 0, 0, 0.05);
            --glass-header: rgba(255, 255, 255, 0.6);
            --blob-1: rgba(56, 189, 248, 0.3);
            --blob-2: rgba(168, 85, 247, 0.3);
            --speed-fast: #16a34a;
            --speed-fast-glow: rgba(22, 163, 74, 0.2);
            --speed-medium: #2563eb;
            --speed-medium-glow: rgba(37, 99, 235, 0.2);
            --speed-slow: #475569;
            --table-border: rgba(0, 0, 0, 0.05);
            --hover-bg: rgba(0, 0, 0, 0.03);
            --sort-icon: rgba(0, 0, 0, 0.3);
            --sort-icon-active: #334155;
            --scrollbar-track: rgba(0, 0, 0, 0.02);
            --scrollbar-thumb: rgba(0, 0, 0, 0.1);
            --scrollbar-thumb-hover: rgba(0, 0, 0, 0.2);
        }

        .dark {
            --bg-gradient-start: #0f172a;
            --bg-gradient-end: #1e1b4b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --glass-bg: rgba(255, 255, 255, 0.03);
            --glass-border: rgba(255, 255, 255, 0.05);
            --glass-header: rgba(15, 23, 42, 0.6);
            --blob-1: rgba(59, 130, 246, 0.2);
            --blob-2: rgba(168, 85, 247, 0.2);
            --speed-fast: #4ade80;
            --speed-fast-glow: rgba(74, 222, 128, 0.4);
            --speed-medium: #60a5fa;
            --speed-medium-glow: rgba(96, 165, 250, 0.4);
            --speed-slow: #94a3b8;
            --table-border: rgba(255, 255, 255, 0.05);
            --hover-bg: rgba(255, 255, 255, 0.05);
            --sort-icon: rgba(255, 255, 255, 0.3);
            --sort-icon-active: #ffffff;
            --scrollbar-track: rgba(255, 255, 255, 0.02);
            --scrollbar-thumb: rgba(255, 255, 255, 0.1);
            --scrollbar-thumb-hover: rgba(255, 255, 255, 0.2);
        }

        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
            color: var(--text-main);
            min-height: 100vh;
            margin: 0;
            background-attachment: fixed;
            transition: background 0.3s ease, color 0.3s ease;
        }

        /* Glassmorphism utilities */
        .glass-panel {
            background: var(--glass-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid var(--glass-border);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);
            transition: background 0.3s ease, border-color 0.3s ease;
        }
        .dark .glass-panel {
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .glass-header {
            background: var(--glass-header);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--table-border);
            transition: background 0.3s ease, border-color 0.3s ease;
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        /* Animations */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
            animation: fadeIn 0.4s ease-out forwards;
        }

        .row-enter {
            animation: fadeIn 0.3s ease-out forwards;
            opacity: 0;
        }

        /* Speed Glows */
        .speed-fast {
            color: var(--speed-fast);
            text-shadow: 0 0 10px var(--speed-fast-glow);
        }
        .speed-medium {
            color: var(--speed-medium);
            text-shadow: 0 0 10px var(--speed-medium-glow);
        }
        .speed-slow {
            color: var(--speed-slow);
        }

        th {
            cursor: pointer;
            user-select: none;
            transition: background-color 0.2s;
        }
        th:hover {
            background-color: var(--hover-bg);
        }
        
        .sort-icon {
            display: inline-block;
            width: 0;
            height: 0;
            margin-left: 5px;
            vertical-align: middle;
            border-right: 4px solid transparent;
            border-left: 4px solid transparent;
            opacity: 0.3;
        }
        .sort-asc .sort-icon {
            border-bottom: 4px solid var(--sort-icon-active);
            border-top: none;
            opacity: 1;
        }
        .sort-desc .sort-icon {
            border-top: 4px solid var(--sort-icon-active);
            border-bottom: none;
            opacity: 1;
        }
        
        .blob-1 {
            background-color: var(--blob-1);
        }
        .blob-2 {
            background-color: var(--blob-2);
        }
        
        .table-row-hover:hover {
            background-color: var(--hover-bg);
        }
        
        .border-table {
            border-color: var(--table-border);
        }
        
        .divide-table > :not([hidden]) ~ :not([hidden]) {
            border-color: var(--table-border);
        }
`;

content = content.replace(/<style>[\s\S]*?<\/style>/, `<style>\n${newStyles}\n    </style>`);

// Update blobs
content = content.replace('bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20', 'blob-1 rounded-full mix-blend-multiply filter blur-3xl');
content = content.replace('bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20', 'blob-2 rounded-full mix-blend-multiply filter blur-3xl');

// Update text colors to use Tailwind dark mode classes or CSS variables
content = content.replace(/text-slate-400/g, 'text-slate-500 dark:text-slate-400');
content = content.replace(/text-slate-300/g, 'text-slate-700 dark:text-slate-300');
content = content.replace(/text-slate-200/g, 'text-slate-800 dark:text-slate-200');
content = content.replace(/text-white/g, 'text-slate-900 dark:text-white');

// Update borders and divides
content = content.replace(/divide-white\/5/g, 'divide-table');
content = content.replace(/border-white\/5/g, 'border-table');

// Update buttons and hover states
content = content.replace(/bg-white\/5/g, 'bg-black/5 dark:bg-white/5');
content = content.replace(/hover:bg-white\/10/g, 'hover:bg-black/10 dark:hover:bg-white/10');
content = content.replace(/border-white\/10/g, 'border-black/10 dark:border-white/10');

// Add theme switcher to header
const themeSwitcher = `
            <div class="flex items-center gap-4 relative z-10">
                <!-- Theme Switcher -->
                <div class="flex gap-1 bg-black/5 dark:bg-black/40 p-1 rounded-full border border-black/10 dark:border-white/10 shadow-inner">
                    <button class="theme-btn px-3 py-1.5 rounded-full text-xs font-medium transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" data-theme="light">Light</button>
                    <button class="theme-btn px-3 py-1.5 rounded-full text-xs font-medium transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" data-theme="dark">Dark</button>
                    <button class="theme-btn px-3 py-1.5 rounded-full text-xs font-medium transition-colors text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" data-theme="auto">Auto</button>
                </div>
`;
content = content.replace('<div class="flex items-center gap-4 relative z-10">', themeSwitcher);

// Update table row hover
content = content.replace(/hover:bg-white\/5/g, 'table-row-hover');

// Add theme script
const themeScript = `
    <script>
        // Theme Management
        function applyTheme(theme) {
            const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            
            // Update active button state
            document.querySelectorAll('.theme-btn').forEach(btn => {
                if (btn.dataset.theme === theme) {
                    btn.classList.add('bg-white', 'dark:bg-white/20', 'text-slate-900', 'dark:text-white', 'shadow-sm');
                    btn.classList.remove('text-slate-600', 'dark:text-slate-400');
                } else {
                    btn.classList.remove('bg-white', 'dark:bg-white/20', 'text-slate-900', 'dark:text-white', 'shadow-sm');
                    btn.classList.add('text-slate-600', 'dark:text-slate-400');
                }
            });
        }

        function initTheme() {
            const savedTheme = localStorage.getItem('theme-mode') || 'auto';
            applyTheme(savedTheme);

            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const theme = e.target.dataset.theme;
                    localStorage.setItem('theme-mode', theme);
                    applyTheme(theme);
                    // Dispatch event for other pages/components if needed
                    window.dispatchEvent(new Event('theme-changed'));
                });
            });

            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (localStorage.getItem('theme-mode') === 'auto' || !localStorage.getItem('theme-mode')) {
                    applyTheme('auto');
                }
            });
        }
        
        // Run immediately to prevent flash
        const initialTheme = localStorage.getItem('theme-mode') || 'auto';
        if (initialTheme === 'dark' || (initialTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        }
        
        document.addEventListener('DOMContentLoaded', initTheme);
    </script>
`;

content = content.replace('</head>', themeScript + '\n</head>');

fs.writeFileSync('results.html', content);
