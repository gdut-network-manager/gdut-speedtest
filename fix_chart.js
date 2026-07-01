const fs = require('fs');
let content = fs.readFileSync('chart.html', 'utf8');

content = content.replace(/maintainAspectRatio: false\n                }\n            \}\);\n        \}/, `maintainAspectRatio: false
                }
            });
            
            const isDark = document.documentElement.classList.contains("dark");
            updateChartTheme(isDark);
        }`);

fs.writeFileSync('chart.html', content);
