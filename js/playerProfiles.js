let eloChartInstance = null;

function openPlayerProfile(id) {
    const p = playersData.find(pl => pl.id === id);
    if (!p) return;

    // 1. Osnovni podatki
    document.getElementById('profilePlayerName').textContent = p.name;
    document.getElementById('profileElo').textContent = p.rating;
    document.getElementById('profileWins').textContent = p.wins;
    document.getElementById('profileLosses').textContent = p.losses;
    
    const total = p.wins + p.losses;
    document.getElementById('profileWinRate').textContent = total ? Math.round((p.wins/total)*100) + '%' : '0%';

    // 2. Klic funkcij za izris ostalih sekcij
    renderHeadToHead(id);
    renderRecentMatches(id);
    renderProfileStats(id);
    renderAchievements(id); // <--- TUKAJ SE KLIČEJO ACHIEVEMENTI
    renderEloChart(id);
    renderSurfaceStats(id);

    // 3. Prikaži modal
    const modal = document.getElementById('playerProfileModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; 
}

function closePlayerProfile() {
    document.getElementById('playerProfileModal').classList.add('hidden');
    document.body.style.overflow = '';
    if (eloChartInstance) {
        eloChartInstance.destroy();
        eloChartInstance = null;
    }
}

// IZRIS ACHIEVEMENTOV
function renderAchievements(pid) {
    const unlocked = window.checkPlayerAchievements(pid);
    const container = document.getElementById('achievementsSection');
    
    if (unlocked.length === 0) {
        container.innerHTML = ''; // Prazno če ni achievementov
        return;
    }

    const html = unlocked.map(key => {
        const a = window.ACHIEVEMENTS[key];
        // Uporabljen stil, ki paše na temno ozadje (rumeno/zlato)
        return `
            <div class="inline-flex items-center gap-2 bg-yellow-900/40 text-yellow-100 border border-yellow-700/50 px-3 py-2 rounded-lg text-xs shadow-sm transform transition hover:scale-105 cursor-help" title="${a.desc}">
                <span class="text-lg">${a.icon}</span>
                <span class="font-semibold">${a.name}</span>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <h3 class="text-lg font-bold text-gray-300 mb-3 border-b border-gray-700 pb-1">Dosežki 🏆</h3>
        <div class="flex flex-wrap gap-2">${html}</div>
    `;
}

// Head-to-Head
function renderHeadToHead(pid) {
    const opps = {};
    matchesData.filter(m => m.winnerId === pid || m.loserId === pid).forEach(m => {
        const isWin = m.winnerId === pid;
        const oid = isWin ? m.loserId : m.winnerId;
        const oname = isWin ? m.loserName : m.winnerName;
        
        if (!opps[oid]) opps[oid] = { name: oname, w: 0, l: 0, id: oid };
        isWin ? opps[oid].w++ : opps[oid].l++;
    });

    const html = Object.values(opps)
        .sort((a,b) => (b.w+b.l) - (a.w+a.l))
        .map(o => {
            const total = o.w + o.l;
            const pct = Math.round((o.w/total)*100);
            // Barvna koda za H2H
            const scoreClass = o.w > o.l ? 'text-emerald-400' : (o.w < o.l ? 'text-red-400' : 'text-gray-400');
            
            return `
            <div class="flex justify-between items-center bg-gray-700 p-3 rounded-lg mb-2 cursor-pointer hover:bg-gray-600 transition border-l-4 ${o.w > o.l ? 'border-emerald-500' : 'border-transparent'}" onclick="openPlayerProfile('${o.id}')">
                <span class="font-medium text-gray-200">${o.name}</span>
                <div class="text-right">
                    <span class="${scoreClass} font-bold text-base">${o.w} - ${o.l}</span>
                    <span class="text-xs text-gray-500 ml-1 block">(${pct}%)</span>
                </div>
            </div>`;
        }).join('');
        
    document.getElementById('headToHeadList').innerHTML = html || '<div class="text-gray-500 text-sm italic p-2">Ni odigranih tekem</div>';
}

// Zadnje tekme
function renderRecentMatches(pid) {
    const matches = matchesData
        .filter(m => m.winnerId === pid || m.loserId === pid)
        .sort((a,b) => b.id - a.id)
        .slice(0, 5);
        
    const html = matches.map(m => {
        const isWin = m.winnerId === pid;
        return `
        <div class="flex justify-between items-center text-sm bg-gray-700 p-3 rounded-lg border-l-4 ${isWin ? 'border-emerald-500' : 'border-red-500'}">
            <div>
                <span class="font-bold ${isWin ? 'text-emerald-400' : 'text-red-400'} text-base mr-2">${isWin ? 'W' : 'L'}</span>
                <span class="text-gray-300">vs ${isWin ? m.loserName : m.winnerName}</span>
            </div>
            <div class="text-gray-400 text-xs font-mono bg-gray-800 px-2 py-1 rounded">${m.score}</div>
        </div>`;
    }).join('');
    
    document.getElementById('recentMatches').innerHTML = html || '<div class="text-gray-500 text-sm italic p-2">Ni tekem</div>';
}

// Statistika po podlagah
function renderSurfaceStats(pid) {
    const surfaces = {};
    matchesData.filter(m => m.winnerId === pid || m.loserId === pid).forEach(m => {
        const s = m.surface || 'Neznano';
        if (!surfaces[s]) surfaces[s] = { w: 0, l: 0 };
        m.winnerId === pid ? surfaces[s].w++ : surfaces[s].l++;
    });

    const container = document.getElementById('surfaceStats');
    if (Object.keys(surfaces).length === 0) {
        container.innerHTML = '<div class="col-span-full text-gray-500 text-sm text-center">Ni podatkov</div>';
        return;
    }

    container.innerHTML = Object.entries(surfaces).map(([name, stat]) => `
        <div class="bg-gray-700 p-2 rounded text-center">
            <div class="text-xs text-gray-400 uppercase">${name}</div>
            <div class="font-bold text-white">${stat.w}-${stat.l}</div>
        </div>
    `).join('');
}

// Dodatna statistika
function renderProfileStats(pid) {
    const stats = window.calculatePlayerStatistics(pid);
    const container = document.getElementById('statisticsSection');
    container.innerHTML = `
        <h3 class="text-lg font-bold text-gray-300 mt-4 mb-3 border-b border-gray-700 pb-1">Statistika</h3>
        <div class="grid grid-cols-2 gap-3">
            ${Object.values(stats).map(s => `
                <div class="bg-gray-700 p-3 rounded-lg shadow-sm">
                    <div class="text-xs text-gray-400 mb-1">${s.name}</div>
                    <div class="text-lg font-bold text-gray-100">${s.value}</div>
                </div>
            `).join('')}
        </div>
    `;
}

// ELO Graf
function renderEloChart(pid) {
    const ctx = document.getElementById('eloChart').getContext('2d');
    if (eloChartInstance) eloChartInstance.destroy();

    let current = window.ELO_CONSTANTS.INITIAL_RATING;
    const data = [{x: 'Start', y: current}];
    
    matchesData
        .filter(m => m.winnerId === pid || m.loserId === pid)
        .sort((a,b) => a.id - b.id)
        .forEach((m, i) => {
            const change = m.winnerId === pid ? m.winnerEloChange : m.loserEloChange;
            current += change;
            data.push({x: i+1, y: current});
        });

    eloChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.x),
            datasets: [{
                label: 'ELO',
                data: data.map(d => d.y),
                borderColor: '#f59e0b',
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: '#f59e0b',
                tension: 0.2,
                fill: true,
                backgroundColor: 'rgba(245, 158, 11, 0.1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { 
                    grid: { color: '#374151' }, 
                    ticks: { color: '#9ca3af', font: { size: 10 } } 
                }
            }
        }
    });
}

window.openPlayerProfile = openPlayerProfile;
window.closePlayerProfile = closePlayerProfile;