const ACHIEVEMENTS = {
    // --- ELO DOSEŽKI ---
    elo_master_1200: { 
        name: "ELO Master 1200", desc: "Doseži 1200 ELO", icon: "🥉", 
        check: (p) => p.rating >= 1200
    },
    elo_master_1400: { 
        name: "ELO Master 1400", desc: "Doseži 1400 ELO", icon: "🥈", 
        check: (p) => p.rating >= 1400
    },
    elo_master_1600: { 
        name: "ELO Master 1600", desc: "Doseži 1600 ELO", icon: "🥇", 
        check: (p) => p.rating >= 1600
    },
    
    // --- POSEBNE ZMAGE (Underdog & Giant Killer) ---
    giant_killer: { 
        name: "Giant Killer", desc: "Zmagaj kot nižje uvrščen (200+ ELO razlike)", icon: "🎯",
        check: (p, matches) => matches.some(m => m.winnerId === p.id && m.winnerEloChange >= 25) // Cca 25 točk dobiš pri veliki razliki
    },
    underdog: { 
        name: "Underdog", desc: "Zmagaj proti favoritu (150+ ELO razlike)", icon: "🐶",
        check: (p, matches) => matches.some(m => m.winnerId === p.id && m.winnerEloChange >= 20) 
    },
    
    // --- PERFEKCIJA ---
    perfect_match: { 
        name: "Perfektna Tekma", desc: "Zmagaj z 6-0, 6-0", icon: "💯",
        check: (p, matches) => matches.some(m => m.winnerId === p.id && m.score.includes('6-0') && m.score.includes('0-6'))
    },
    set_machine: { 
        name: "Setni Stroj", desc: "Zmagaj set z 6-0", icon: "🥯",
        check: (p, matches) => matches.some(m => m.winnerId === p.id && (m.score.includes('6-0') || m.score.includes('0-6')))
    },
    tiebreak_master: { 
        name: "Tie-break Mojster", desc: "Zmagaj set s 7-6", icon: "🎪",
        check: (p, matches) => matches.some(m => m.winnerId === p.id && (m.score.includes('7-6') || m.score.includes('6-7')))
    },
    
    // --- STREAKI (Serije) ---
    hot_streak: { 
        name: "Vroča Serija", desc: "3 zaporedne zmage", icon: "🔥",
        check: (p, matches) => checkStreak(p, matches, 3)
    },
    unstoppable: { 
        name: "Neustavljiv", desc: "5 zaporednih zmag", icon: "⚡",
        check: (p, matches) => checkStreak(p, matches, 5)
    },
    dominator: { 
        name: "Dominator", desc: "10 zaporednih zmag", icon: "👑",
        check: (p, matches) => checkStreak(p, matches, 10)
    },
    
    // --- SITUACIJSKI ---
    comeback_king: { 
        name: "Comeback King", desc: "Zmagaj po izgubljenem prvem setu", icon: "🔄",
        check: (p, matches) => matches.some(m => {
            if (m.winnerId !== p.id) return false;
            const sets = m.score.split(', '); // "4-6, 6-2, 6-1"
            if (sets.length < 2) return false;
            // Preveri če je prvi set izgubil (torej rezultat ni npr. "6-..." ali "7-...")
            const firstSet = sets[0]; 
            const [w, l] = firstSet.split('-').map(Number);
            // Ker je zmagovalec tekme 'p', je v zapisu "W-L" prvi set zanj "W-L".
            // Če je izgubil prvi set, mora biti prva številka manjša od druge.
            return w < l;
        })
    },
    
    // --- RIVALSTVA ---
    rival_3: { 
        name: "Rival 3", desc: "3 zaporedne zmage nad istim igralcem", icon: "⚔️", 
        check: (p, matches) => checkRivalry(p, matches, 3)
    },
    rival_5: { 
        name: "Rival 5", desc: "5 zaporednih zmag nad istim igralcem", icon: "🎭", 
        check: (p, matches) => checkRivalry(p, matches, 5)
    },
    rival_10: { 
        name: "Rival 10", desc: "10 zaporednih zmag nad istim igralcem", icon: "💥", 
        check: (p, matches) => checkRivalry(p, matches, 10)
    }
};

// --- POMOŽNE FUNKCIJE ---

function checkStreak(player, matches, count) {
    // Dobimo vse tekme igralca, sortirane od najnovejše (zgoraj) navzdol
    const playerMatches = matches
        .filter(m => m.winnerId === player.id || m.loserId === player.id)
        .sort((a, b) => b.id - a.id);

    let streak = 0;
    for (let m of playerMatches) {
        if (m.winnerId === player.id) {
            streak++;
            if (streak >= count) return true;
        } else {
            streak = 0; // Prekinitev niza
        }
    }
    return false;
}

function checkRivalry(player, matches, count) {
    const playerMatches = matches
        .filter(m => m.winnerId === player.id || m.loserId === player.id)
        .sort((a, b) => b.id - a.id);
    
    const opponents = {};
    
    for (let m of playerMatches) {
        const opponentId = m.winnerId === player.id ? m.loserId : m.winnerId;
        
        if (!opponents[opponentId]) opponents[opponentId] = 0;
        
        if (m.winnerId === player.id) {
            opponents[opponentId]++;
            if (opponents[opponentId] >= count) return true;
        } else {
            opponents[opponentId] = 0; // Reset rivalstva ob porazu
        }
    }
    return false;
}

// --- GLAVNA FUNKCIJA ---
window.checkPlayerAchievements = (pid) => {
    const p = playersData.find(x => x.id === pid);
    if (!p) return [];
    
    return Object.keys(ACHIEVEMENTS).filter(key => {
        const ach = ACHIEVEMENTS[key];
        try {
            return ach.check(p, matchesData);
        } catch(e) { 
            console.warn("Napaka pri achievementu:", key, e);
            return false; 
        }
    });
};

window.ACHIEVEMENTS = ACHIEVEMENTS;