const STATISTICS = {
    winRate: {
        name: "Delež Zmag",
        calculate: (pid) => {
            const pm = matchesData.filter(m => m.winnerId === pid || m.loserId === pid);
            if (!pm.length) return { value: "0%", description: "0 tekem", raw: 0 };
            const wins = pm.filter(m => m.winnerId === pid).length;
            return { 
                value: `${Math.round((wins/pm.length)*100)}%`, 
                description: `${wins}/${pm.length}`, 
                raw: (wins/pm.length)*100 
            };
        }
    },
    avgGames: {
        name: "Povp. Gemov",
        calculate: (pid) => {
            const pm = matchesData.filter(m => m.winnerId === pid || m.loserId === pid);
            if (!pm.length) return { value: "0", description: "-", raw: 0 };
            
            let total = 0;
            pm.forEach(m => {
                m.score.split(', ').forEach(s => {
                    const p = s.split('-').map(Number);
                    if(p.length === 2) total += (p[0] + p[1]);
                });
            });
            const avg = (total / pm.length).toFixed(1);
            return { value: avg, description: "na tekmo", raw: parseFloat(avg) };
        }
    },
    threeSets: {
        name: "Maratoni (3 seti)",
        calculate: (pid) => {
            const pm = matchesData.filter(m => m.winnerId === pid || m.loserId === pid);
            if (!pm.length) return { value: "0%", description: "-", raw: 0 };
            const count = pm.filter(m => m.score.split(', ').length === 3).length;
            return { value: `${Math.round((count/pm.length)*100)}%`, description: `${count} tekem`, raw: count };
        }
    },
    consistency: {
        name: "Konsistentnost",
        calculate: (pid) => {
            const pm = matchesData.filter(m => m.winnerId === pid || m.loserId === pid);
            if (pm.length < 3) return { value: "N/A", description: "Premalo tekem", raw: 0 };
            
            // Calculate variance in ELO changes (simplified)
            const changes = pm.map(m => Math.abs(m.winnerId === pid ? m.winnerEloChange : m.loserEloChange));
            const avg = changes.reduce((a,b)=>a+b,0) / changes.length;
            const variance = changes.reduce((a,b)=>a+Math.pow(b-avg,2),0) / changes.length;
            const score = Math.max(0, 100 - Math.sqrt(variance)*3); // Arbitrary formula
            
            return { value: Math.round(score), description: "/ 100", raw: score };
        }
    }
};

window.calculatePlayerStatistics = (pid) => {
    const res = {};
    for(const k in STATISTICS) res[k] = { name: STATISTICS[k].name, ...STATISTICS[k].calculate(pid) };
    return res;
};