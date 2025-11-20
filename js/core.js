// Globalne spremenljivke
let playersData = []; 
let matchesData = []; 
let scheduledMatchesData = [];
let filteredPlayerId = null; 
let showAllHistory = false;

// UTILITY FUNCTIONS
function showMessage(message, type = 'success') {
    const box = document.getElementById('messageBox');
    box.textContent = message;
    box.className = 'p-4 mb-6 rounded-lg text-center font-medium shadow-lg transform transition-all duration-300';
    
    const colors = {
        success: 'bg-green-600 text-white',
        error: 'bg-red-600 text-white',
        info: 'bg-blue-600 text-white'
    };
    
    box.classList.add(...(colors[type] || colors.info).split(' '));
    box.classList.remove('hidden');
    
    if(window.innerWidth < 768) {
        box.scrollIntoView({behavior: "smooth", block: "center"});
    }

    setTimeout(() => {
        box.classList.add('hidden');
        box.className = ''; 
    }, 4000);
}

function toggleAddPlayerForm() {
    const form = document.getElementById('addPlayerForm');
    const buttonText = document.getElementById('togglePlayerText');
    const isHidden = form.classList.toggle('hidden');
    buttonText.textContent = isHidden ? 'Dodaj Novega Igralca' : 'Skrij Vnos';
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('matchDateInput');
    if (dateInput) dateInput.value = today;
}

function showMainContent() {
    document.getElementById('loadingIndicator').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
}

// ELO CALCULATION
function calculateEloFromMatches(currentPlayers, currentMatches) {
    const playerMap = new Map();
    
    for (const p of currentPlayers) {
        playerMap.set(p.id, {
            id: p.id,
            name: p.name,
            rating: window.ELO_CONSTANTS.INITIAL_RATING,
            wins: 0,
            losses: 0
        });
    }

    const matches = [...currentMatches].sort((a, b) => a.id - b.id);

    for (const match of matches) {
        const winner = playerMap.get(match.winnerId);
        const loser = playerMap.get(match.loserId);
        
        if (!winner || !loser) continue;
        
        let currentKFactor = match.type === 'short' ? window.ELO_CONSTANTS.K_FACTOR / 2 : window.ELO_CONSTANTS.K_FACTOR;
        let finalRatingChange = 0;
        
        if (match.type !== 'draw') {
            const expectedScoreA = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
            finalRatingChange = Math.round(currentKFactor * (1 - expectedScoreA));

            winner.rating += finalRatingChange;
            loser.rating -= finalRatingChange;
            winner.wins++;
            loser.losses++;
        }
        
        match.winnerNewRating = winner.rating;
        match.loserNewRating = loser.rating;
        match.winnerEloChange = finalRatingChange;
        match.loserEloChange = -finalRatingChange;
    }
    
    return playerMap;
}

async function recalculateEloAndSave() {
    if (!window.firebaseDb) return;

    const updatedPlayerMap = calculateEloFromMatches(playersData, matchesData);
    const { doc, writeBatch } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
    const batch = writeBatch(window.firebaseDb);
    const playersRef = window.getFirestoreCollectionPaths().players;
    
    let operationsCount = 0;
    
    updatedPlayerMap.forEach((updatedPlayer, id) => {
        const existingPlayer = playersData.find(p => p.id === id);
        if (existingPlayer) {
            const ref = doc(playersRef, id);
            batch.update(ref, {
                rating: updatedPlayer.rating,
                wins: updatedPlayer.wins,
                losses: updatedPlayer.losses
            });
            operationsCount++;
        }
    });

    if (operationsCount > 0) {
        try {
            await batch.commit();
            console.log('ELO posodobljen.');
        } catch (e) {
            console.error('Napaka pri batch update ELO:', e);
        }
    }
}

// FIREBASE OPERATIONS
async function addPlayer() {
    if (!window.firebaseDb) return showMessage('Baza ni povezana', 'error');

    const input = document.getElementById('newPlayerName');
    const name = input.value.trim();

    if (!name) return showMessage('Vnesite ime igralca.', 'error');
    if (playersData.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        return showMessage(`Igralec "${name}" že obstaja.`, 'error');
    }

    try {
        const { addDoc, updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        const playersRef = window.getFirestoreCollectionPaths().players;
        
        const docRef = await addDoc(playersRef, {
            name: name,
            rating: window.ELO_CONSTANTS.INITIAL_RATING,
            wins: 0,
            losses: 0,
            weeksNo1: 0,
            weeksLast: 0
        });
        
        await updateDoc(doc(playersRef, docRef.id), { id: docRef.id });

        input.value = '';
        toggleAddPlayerForm();
        showMessage(`Igralec "${name}" dodan!`, 'success');
    } catch (e) {
        console.error("Napaka:", e);
        showMessage('Napaka pri dodajanju', 'error');
    }
}

async function recordMatch() {
    if (!window.firebaseDb) return showMessage('Baza ni povezana', 'error');

    const winnerId = document.getElementById('winnerSelect').value;
    const loserId = document.getElementById('loserSelect').value;
    const dateInput = document.getElementById('matchDateInput').value;
    const surface = document.getElementById('surfaceSelect').value;
    const matchType = document.getElementById('matchTypeSelect').value;

    const sets = [1, 2, 3].map(i => {
        const w = document.getElementById(`set${i}WinnerScore`).value.trim();
        const l = document.getElementById(`set${i}LoserScore`).value.trim();
        return (w !== '' && l !== '') ? `${w}-${l}` : null;
    }).filter(Boolean);
    
    const scoreString = sets.join(', ');

    if (winnerId === '0' || loserId === '0' || winnerId === loserId) {
        return showMessage('Izberite veljavne igralce.', 'error');
    }
    if (!scoreString && matchType !== 'draw') {
         return showMessage('Vnesite rezultat vsaj prvega seta.', 'error');
    }

    const winner = playersData.find(p => p.id === winnerId);
    const loser = playersData.find(p => p.id === loserId);

    if (!winner || !loser) return showMessage('Napaka v podatkih igralcev.', 'error');
    
    let dateString = dateInput ? 
        new Date(dateInput).toLocaleDateString('sl-SI', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 
        new Date().toLocaleDateString('sl-SI') + ' ' + new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });

    const newMatch = {
        id: Date.now(),
        date: dateString,
        winnerId, loserId,
        winnerName: winner.name,
        loserName: loser.name,
        score: matchType === 'draw' ? '1-1' : scoreString,
        surface,
        type: matchType,
    };

    try {
        const { addDoc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        await addDoc(window.getFirestoreCollectionPaths().matches, newMatch);

        // Reset inputs
        [1,2,3].forEach(i => {
            document.getElementById(`set${i}WinnerScore`).value = '';
            document.getElementById(`set${i}LoserScore`).value = '';
        });
        document.getElementById('winnerSelect').value = '0';
        document.getElementById('loserSelect').value = '0';

        showMessage(`Tekma zabeležena!`, 'success');
    } catch (e) {
        console.error("Error recording match:", e);
        showMessage('Napaka pri zapisu tekme', 'error');
    }
}

async function deleteMatch(docId) {
    if (!window.firebaseDb) return;
    if (!confirm('Ali res želiš izbrisati to tekmo?')) return;

    try {
        const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        await deleteDoc(doc(window.getFirestoreCollectionPaths().matches, docId));
        showMessage('Tekma izbrisana', 'success');
    } catch (e) {
        showMessage('Napaka pri brisanju', 'error');
    }
}

// RENDER FUNCTIONS
function renderRanking() {
    const tableBody = document.getElementById('rankingTable');
    const players = [...playersData].sort((a, b) => b.rating - a.rating);
    tableBody.innerHTML = '';

    if (players.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-gray-500">Ni igralcev.</td></tr>`;
        return;
    }

    players.forEach((player, index) => {
        const rank = index + 1;
        let badges = '';
        let subtext = '';
        
        // Logika za prikaz "weeks at No1"
        if (rank === 1 && players.length > 0) {
            badges = ` 🐐`;
            const weeks = player.weeksNo1 || 0;
            if(weeks > 0) {
                subtext = `<div class="text-[11px] text-yellow-500 font-normal mt-0.5">👑 ${weeks} ${weeks===1?'teden':weeks===2?'tedna':'tednov'} na vrhu</div>`;
            }
        } else if (rank === players.length && players.length > 1) {
            badges = ` 🥔`;
            const weeks = player.weeksLast || 0;
            if(weeks > 0) {
                subtext = `<div class="text-[11px] text-purple-400 font-normal mt-0.5">⚓ ${weeks} ${weeks===1?'teden':weeks===2?'tedna':'tednov'} na dnu</div>`;
            }
        }

        const row = document.createElement('tr');
        // Originalni sodo/lihi stil
        row.className = index % 2 === 0 ? 'table-row-even' : 'table-row-odd';

        row.innerHTML = `
            <td class="py-3 px-2 font-bold text-lg text-primary text-center">${rank}.</td>
            <td class="py-3 px-2 font-medium cursor-pointer hover:text-primary transition col-name" onclick="window.openPlayerProfile('${player.id}')">
                <div class="flex flex-col justify-center h-full">
                    <span class="font-bold text-gray-100 text-base">${player.name}${badges}</span>
                    ${subtext}
                </div>
            </td>
            <td class="py-3 px-2 font-bold text-white text-center text-base">${player.rating}</td>
            <td class="py-3 px-2 text-emerald-400 text-center font-bold text-base">${player.wins || 0}</td>
            <td class="py-3 px-2 text-red-400 text-center font-bold text-base">${player.losses || 0}</td>
        `;
        tableBody.appendChild(row);
    });
}

function renderMatchHistory() {
    const containerDiv = document.getElementById('matchHistoryContainer');
    
    const matchesCopy = JSON.parse(JSON.stringify(matchesData));
    const playersCopy = JSON.parse(JSON.stringify(playersData));
    calculateEloFromMatches(playersCopy, matchesCopy);

    const allMatches = matchesCopy.sort((a, b) => b.id - a.id);
    let filteredMatches = allMatches;
    let filterHtml = '';

    if (filteredPlayerId) {
        filteredMatches = allMatches.filter(m => m.winnerId === filteredPlayerId || m.loserId === filteredPlayerId);
        const pName = playersData.find(p => p.id === filteredPlayerId)?.name || 'Igralec';
        filterHtml = `
            <div class="bg-blue-900/30 p-3 rounded-lg flex justify-between items-center text-sm text-blue-200 mb-4 border border-blue-800">
                <span>Filter: <b>${pName}</b></span>
                <button onclick="window.clearPlayerFilter()" class="text-red-400 hover:text-red-300 font-bold">✕ POČISTI</button>
            </div>
        `;
    }
    
    const displayCount = showAllHistory ? filteredMatches.length : 10;
    const matchesToDisplay = filteredMatches.slice(0, displayCount);
    
    if (matchesToDisplay.length === 0) {
        containerDiv.innerHTML = filterHtml + `<p class="text-center py-4 text-gray-500">Ni tekem.</p>`;
        return;
    }

    let listHtml = matchesToDisplay.map(match => {
        const isDraw = match.type === 'draw';
        const eloChangeW = match.winnerEloChange > 0 ? `+${match.winnerEloChange}` : match.winnerEloChange;
        const eloChangeL = match.loserEloChange;
        
        const typeBadge = match.type === 'short' ? '<span class="text-[10px] bg-yellow-900 text-yellow-200 px-1 rounded uppercase">Kratka</span>' : 
                          match.type === 'draw' ? '<span class="text-[10px] bg-blue-900 text-blue-200 px-1 rounded uppercase">Draw</span>' : '';

        return `
            <div class="p-4 bg-gray-700 rounded-lg mb-3 shadow-md border-l-4 ${match.winnerId === filteredPlayerId ? 'border-emerald-500' : 'border-gray-600'}">
                <div class="flex justify-between text-xs text-gray-400 mb-2">
                    <span>${match.date} • ${match.surface || 'Neznano'}</span>
                    <button onclick="window.deleteMatch('${match.docId}')" class="text-red-500 hover:text-red-400">🗑️</button>
                </div>
                <div class="flex justify-between items-center mb-2">
                    <div class="flex-1">
                        <div class="font-bold text-base text-emerald-400 truncate">${match.winnerName} <span class="text-xs text-gray-500 font-normal">(${match.winnerNewRating})</span></div>
                        <div class="font-bold text-base text-red-400 truncate">${match.loserName} <span class="text-xs text-gray-500 font-normal">(${match.loserNewRating})</span></div>
                    </div>
                    <div class="text-right">
                        <div class="text-xl font-bold text-white tracking-wider">${match.score}</div>
                        ${typeBadge}
                    </div>
                </div>
                ${!isDraw ? `
                <div class="flex justify-between text-xs border-t border-gray-600 pt-2 mt-1 opacity-70">
                    <span class="text-emerald-400 font-mono">ELO: ${eloChangeW}</span>
                    <span class="text-red-400 font-mono">ELO: ${eloChangeL}</span>
                </div>` : ''}
            </div>
        `;
    }).join('');

    if (!showAllHistory && filteredMatches.length > 10) {
        listHtml += `<button onclick="window.toggleHistoryView()" class="w-full py-3 text-sm text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition font-bold">PRIKAŽI VSE (${filteredMatches.length})</button>`;
    } else if (showAllHistory) {
        listHtml += `<button onclick="window.toggleHistoryView()" class="w-full py-3 text-sm text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition font-bold">PRIKAŽI MANJ</button>`;
    }

    containerDiv.innerHTML = filterHtml + listHtml;
}

function renderSelects() {
    const selects = ['winnerSelect', 'loserSelect', 'scheduledPlayer1', 'scheduledPlayer2'];
    const players = [...playersData].sort((a, b) => a.name.localeCompare(b.name));
    
    const options = '<option value="0">Izberi...</option>' + 
        players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    selects.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const current = el.value;
            el.innerHTML = options;
            if(current && current !== '0') el.value = current;
        }
    });
}

function renderAll() {
    renderRanking();
    renderSelects();
    renderMatchHistory();
    if (window.renderScheduledMatches) window.renderScheduledMatches();
    showMainContent();
}

// WEEKS TRACKING
async function updateWeeksAtPositions() {
    const now = Date.now();
    const lastUpdate = parseInt(localStorage.getItem('lastRankingUpdate') || '0');
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000; 

    if (now - lastUpdate < WEEK_MS) return;
    if (playersData.length === 0) return;

    const sorted = [...playersData].sort((a, b) => b.rating - a.rating);
    const top = sorted[0];
    const bottom = sorted.length > 1 ? sorted[sorted.length - 1] : null;

    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
    const playersRef = window.getFirestoreCollectionPaths().players;

    try {
        if (top) await updateDoc(doc(playersRef, top.id), { weeksNo1: (top.weeksNo1 || 0) + 1 });
        if (bottom) await updateDoc(doc(playersRef, bottom.id), { weeksLast: (bottom.weeksLast || 0) + 1 });
        
        localStorage.setItem('lastRankingUpdate', now.toString());
        console.log("Weeks updated");
    } catch (e) {
        console.error("Weeks update failed", e);
    }
}

// INITIALIZATION
window.onFirebaseReady = async function() {
    console.log("🚀 Zagon aplikacije...");
    setDefaultDate();
    
    const { onSnapshot } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
    const paths = window.getFirestoreCollectionPaths();
    
    // Listeners
    onSnapshot(paths.players, (snap) => {
        playersData = snap.docs.map(d => ({...d.data(), docId: d.id, id: d.data().id || d.id}));
        updateWeeksAtPositions();
        renderAll();
    });

    onSnapshot(paths.matches, (snap) => {
        matchesData = snap.docs.map(d => ({...d.data(), docId: d.id}));
        recalculateEloAndSave(); 
        renderAll();
    });

    onSnapshot(paths.scheduled_matches, (snap) => {
        scheduledMatchesData = snap.docs.map(d => ({...d.data(), docId: d.id}));
        if (window.renderScheduledMatches) window.renderScheduledMatches();
    });
};

// Helper exports for other files
window.deleteMatch = deleteMatch;
window.recordMatch = recordMatch;
window.addPlayer = addPlayer;
window.toggleAddPlayerForm = toggleAddPlayerForm;
window.filterHistoryByPlayer = (id) => { filteredPlayerId = id; showAllHistory = true; renderAll(); };
window.clearPlayerFilter = () => { filteredPlayerId = null; showAllHistory = false; renderAll(); };
window.toggleHistoryView = () => { showAllHistory = !showAllHistory; renderMatchHistory(); };

if (window.firebaseReady) window.onFirebaseReady();