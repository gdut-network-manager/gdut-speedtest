const fs = require('fs');
let content = fs.readFileSync('chart.html', 'utf8');

const newUpdateChartTheme = `
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
            
            // Update dataset colors
            const darkColors = [
                { border: '#4ade80', bg: 'rgba(74, 222, 128, 0.2)' }, // Green
                { border: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' }, // Blue
                { border: '#c084fc', bg: 'rgba(192, 132, 252, 0.2)' }, // Purple
                { border: '#f472b6', bg: 'rgba(244, 114, 182, 0.2)' }, // Pink
                { border: '#fbbf24', bg: 'rgba(251, 191, 36, 0.2)' }   // Yellow
            ];
            
            const lightColors = [
                { border: '#16a34a', bg: 'rgba(22, 163, 74, 0.2)' }, // Darker Green
                { border: '#2563eb', bg: 'rgba(37, 99, 235, 0.2)' }, // Darker Blue
                { border: '#9333ea', bg: 'rgba(147, 51, 234, 0.2)' }, // Darker Purple
                { border: '#db2777', bg: 'rgba(219, 39, 119, 0.2)' }, // Darker Pink
                { border: '#d97706', bg: 'rgba(217, 119, 6, 0.2)' }   // Darker Yellow
            ];
            
            const colors = isDark ? darkColors : lightColors;
            
            window.myScatter.data.datasets.forEach((dataset, i) => {
                if (i < colors.length) {
                    dataset.borderColor = colors[i].border;
                    dataset.backgroundColor = colors[i].bg;
                    dataset.pointBackgroundColor = colors[i].border;
                    dataset.pointBorderColor = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,1)';
                } else {
                    dataset.borderColor = isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.5)';
                    dataset.backgroundColor = isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)';
                    dataset.pointBackgroundColor = isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.5)';
                }
            });
            
            window.myScatter.update();
        }
`;

content = content.replace(/function updateChartTheme\(isDark\) \{[\s\S]*?window\.myScatter\.update\(\);\n        \}/, newUpdateChartTheme);

fs.writeFileSync('chart.html', content);
