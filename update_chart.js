const fs = require('fs');
let content = fs.readFileSync('chart.html', 'utf8');

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
            --blob-1: rgba(56, 189, 248, 0.3);
            --blob-2: rgba(168, 85, 247, 0.3);
        }

        .dark {
            --bg-gradient-start: #0f172a;
            --bg-gradient-end: #1e1b4b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --glass-bg: rgba(255, 255, 255, 0.03);
            --glass-border: rgba(255, 255, 255, 0.05);
            --blob-1: rgba(59, 130, 246, 0.2);
            --blob-2: rgba(168, 85, 247, 0.2);
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

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fade-in {
            animation: fadeIn 0.4s ease-out forwards;
        }

        .chart-container {
            position: relative;
            height: 70vh;
            width: 100%;
        }
        
        .blob-1 {
            background-color: var(--blob-1);
        }
        .blob-2 {
            background-color: var(--blob-2);
        }
`;

content = content.replace(/<style>[\s\S]*?<\/style>/, `<style>\n${newStyles}\n    </style>`);

// Update blobs
content = content.replace('bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20', 'blob-1 rounded-full mix-blend-multiply filter blur-3xl');
content = content.replace('bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20', 'blob-2 rounded-full mix-blend-multiply filter blur-3xl');

// Update text colors
content = content.replace(/text-slate-400/g, 'text-slate-500 dark:text-slate-400');

// Update buttons
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

                <a href="./results.html" class="px-5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition-all duration-300 flex items-center gap-2 text-sm font-medium group">
                    <svg class="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    返回数据列表
                </a>
            </div>
`;
content = content.replace(/<div class="relative z-10">\s*<a href="\.\/results\.html"[\s\S]*?<\/div>/, themeSwitcher);

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
            
            // Update chart if it exists
            if (window.myScatter) {
                updateChartTheme(isDark);
            }
        }

        function initTheme() {
            const savedTheme = localStorage.getItem('theme-mode') || 'auto';
            applyTheme(savedTheme);

            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const theme = e.target.dataset.theme;
                    localStorage.setItem('theme-mode', theme);
                    applyTheme(theme);
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

// Update chart.js configuration to be dynamic
const chartUpdateScript = `
        function updateChartTheme(isDark) {
            if (!window.myScatter) return;
            
            const textColor = isDark ? '#cbd5e1' : '#475569';
            const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
            const zeroLineColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
            const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            const tooltipTitle = isDark ? '#f8fafc' : '#0f172a';
            const tooltipBody = isDark ? '#cbd5e1' : '#334155';
            const tooltipFooter = isDark ? '#94a3b8' : '#64748b';
            const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            
            Chart.defaults.global.defaultFontColor = isDark ? '#94a3b8' : '#64748b';
            
            window.myScatter.options.legend.labels.fontColor = textColor;
            
            window.myScatter.options.scales.xAxes[0].gridLines.color = gridColor;
            window.myScatter.options.scales.xAxes[0].gridLines.zeroLineColor = zeroLineColor;
            window.myScatter.options.scales.xAxes[0].ticks.fontColor = textColor;
            window.myScatter.options.scales.xAxes[0].scaleLabel.fontColor = isDark ? '#94a3b8' : '#64748b';
            
            window.myScatter.options.scales.yAxes[0].gridLines.color = gridColor;
            window.myScatter.options.scales.yAxes[0].gridLines.zeroLineColor = zeroLineColor;
            window.myScatter.options.scales.yAxes[0].ticks.fontColor = textColor;
            window.myScatter.options.scales.yAxes[0].scaleLabel.fontColor = isDark ? '#94a3b8' : '#64748b';
            
            window.myScatter.options.tooltips.backgroundColor = tooltipBg;
            window.myScatter.options.tooltips.titleFontColor = tooltipTitle;
            window.myScatter.options.tooltips.bodyFontColor = tooltipBody;
            window.myScatter.options.tooltips.footerFontColor = tooltipFooter;
            window.myScatter.options.tooltips.borderColor = tooltipBorder;
            
            window.myScatter.update();
        }
`;

content = content.replace('window.onload = function() {', chartUpdateScript + '\n        window.onload = function() {');

// Add updateChartTheme call after chart creation
content = content.replace('window.myScatter = Chart.Scatter(ctx, {', 'window.myScatter = Chart.Scatter(ctx, {');
content = content.replace('});\n        }', '});\n            \n            const isDark = document.documentElement.classList.contains("dark");\n            updateChartTheme(isDark);\n        }');

fs.writeFileSync('chart.html', content);
