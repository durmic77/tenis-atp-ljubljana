// Konstante statusov
const SCHEDULED_MATCH_STATUS = {
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// 1. Upravljanje obrazca
function toggleCreateMatchForm() {
    const form = document.getElementById('createMatchForm');
    const btnText = document.getElementById('toggleCreateMatchText');
    
    const isHidden = form.classList.toggle('hidden');
    
    if (isHidden) {
        btnText.innerHTML = `
            <span class="bg-white/20 rounded-full p-1">📅</span>
            Načrtuj Novo Tekmo
        `;
    } else {
        btnText.textContent = '✖️ Prekliči vnos';
        setDefaultScheduledDate();
    }
}

function setDefaultScheduledDate() {
    const now = new Date();
    const dateInput = document.getElementById('scheduledDate');
    const timeInput = document.getElementById('scheduledTime');

    if (dateInput && !dateInput.value) {
        dateInput.value = now.toISOString().split('T')[0];
    }
    if (timeInput && !timeInput.value) {
        timeInput.value = '18:00';
    }
}

// 2. SHRANJEVANJE NOVE TEKME (Popravljeno in robustno)
async function createNewScheduledMatch() {
    console.log("Začenjam shranjevanje termina...");

    const player1Id = document.getElementById('scheduledPlayer1').value;
    const player2Id = document.getElementById('scheduledPlayer2').value;
    const date = document.getElementById('scheduledDate').value;
    const time = document.getElementById('scheduledTime').value;
    const court = document.getElementById('scheduledCourt').value;
    const surface = document.getElementById('scheduledSurface').value;
    const matchType = document.getElementById('scheduledMatchType').value;
    const notes = document.getElementById('scheduledNotes').value;

    // Validacija
    if (player1Id === '0' || player2Id === '0') {
        alert('Prosim, izberi oba igralca.');
        return;
    }
    if (player1Id === player2Id) {
        alert('Igralca morata biti različna.');
        return;
    }
    if (!date || !time) {
        alert('Datum in ura sta obvezna.');
        return;
    }

    const p1 = playersData.find(p => p.id === player1Id);
    const p2 = playersData.find(p => p.id === player2Id);

    if (!p1 || !p2) {
        console.error("Napaka: Podatki o igralcu niso najdeni.");
        alert('Napaka pri iskanju igralcev. Osveži stran.');
        return;
    }

    const matchData = {
        player1Id, 
        player2Id,
        player1Name: p1.name, 
        player2Name: p2.name,
        scheduledDate: date, 
        scheduledTime: time,
        court: court || 'Teren (nedoločeno)', 
        surface, 
        matchType, 
        notes: notes || '',
        status: SCHEDULED_MATCH_STATUS.SCHEDULED,
        createdAt: Date.now()
    };

    try {
        // POPRAVEK: Uvozimo vse potrebno direktno tukaj, da smo neodvisni od index.html napak
        const { getFirestore, collection, addDoc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        
        // Zagotovimo, da imamo DB referenco
        let db = window.firebaseDb;
        if (!db && window.firebaseApp) {
            db = getFirestore(window.firebaseApp);
        }

        if (!db) {
            throw new Error("Povezava z bazo ni najdena (window.firebaseDb is missing).");
        }

        // Direktna referenca na kolekcijo, da preprečimo napake "undefined"
        const collectionRef = collection(db, 'scheduled_matches');
        
        await addDoc(collectionRef, matchData);
        
        console.log("✅ Uspešno shranjeno!");
        
        toggleCreateMatchForm();
        document.getElementById('scheduledCourt').value = '';
        document.getElementById('scheduledNotes').value = '';
        
        if (window.showMessage) {
            window.showMessage('Tekma uspešno načrtovana!', 'success');
        } else {
            alert('Tekma uspešno načrtovana!');
        }

    } catch (e) {
        console.error("❌ KRITIČNA NAPAKA pri shranjevanju:", e);
        // Izpis točne napake uporabniku za lažje debuggiranje
        alert(`Napaka pri shranjevanju: ${e.message}`);
    }
}

// 3. IZRIS SEZNAMA
function renderScheduledMatches() {
    const container = document.getElementById('scheduledMatchesList');
    if(!container) return;

    const activeMatches = scheduledMatchesData
        .filter(m => m.status === SCHEDULED_MATCH_STATUS.SCHEDULED)
        .sort((a, b) => {
            const dateA = new Date(a.scheduledDate + 'T' + a.scheduledTime);
            const dateB = new Date(b.scheduledDate + 'T' + b.scheduledTime);
            return dateA - dateB;
        });
    
    if (activeMatches.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 text-sm italic py-4">Ni prihajajočih tekem.</div>';
        return;
    }
    
    container.innerHTML = activeMatches.map(match => {
        const dateObj = new Date(match.scheduledDate);
        const dateStr = dateObj.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' });
        
        return `
            <div class="bg-gray-700 border-l-4 border-blue-500 rounded-lg p-4 mb-3 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center group">
                <div class="mb-3 md:mb-0">
                    <div class="font-bold text-white text-base mb-1">
                        ${match.player1Name} <span class="text-blue-400 text-sm px-1">vs</span> ${match.player2Name}
                    </div>
                    <div class="text-sm text-gray-300 flex items-center gap-2">
                        <span>📅 ${dateStr}</span>
                        <span class="text-blue-300 font-mono">🕒 ${match.scheduledTime}</span>
                    </div>
                    <div class="text-xs text-gray-400 mt-1">
                        📍 ${match.court} • ${match.surface}
                    </div>
                    ${match.notes ? `<div class="text-xs text-gray-500 italic mt-1 border-t border-gray-600 pt-1">📝 ${match.notes}</div>` : ''}
                </div>
                
                <div class="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                    <button onclick="openResultModal('${match.docId}')" class="flex-1 md:flex-none bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-2 rounded shadow transition transform hover:scale-105">
                        ✅ VPIŠI
                    </button>
                    <button onclick="cancelMatch('${match.docId}')" class="flex-1 md:flex-none bg-gray-600 hover:bg-red-500 text-white text-xs px-3 py-2 rounded transition">
                        ❌ Prekliči
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 4. PREKLIC
async function cancelMatch(id) {
    if(!confirm("Ali res želiš preklicati to tekmo?")) return;
    
    try {
        const { getFirestore, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        
        // Robusten DB dostop
        let db = window.firebaseDb;
        if (!db && window.firebaseApp) db = getFirestore(window.firebaseApp);

        const matchRef = doc(db, 'scheduled_matches', id);
        await updateDoc(matchRef, { status: 'cancelled' });
        
        if (window.showMessage) window.showMessage('Tekma preklicana.', 'info');
    } catch (e) {
        console.error("Napaka pri preklicu:", e);
        alert("Napaka pri preklicu tekme.");
    }
}

// 5. LOGIKA ZA MODAL
let currentScheduledMatchId = null;

window.openResultModal = function(scheduleId) {
    currentScheduledMatchId = scheduleId;
    const match = scheduledMatchesData.find(m => m.docId === scheduleId);
    if (!match) return;

    const modal = document.getElementById('resultModal');
    
    document.getElementById('resultMatchInfo').innerHTML = `
        <div class="font-bold text-white">${match.player1Name} vs ${match.player2Name}</div>
        <div class="text-xs mt-1 text-gray-400">${match.scheduledDate} • ${match.court}</div>
    `;

    const winnerSelect = document.getElementById('resultWinner');
    winnerSelect.innerHTML = `
        <option value="0">Izberi zmagovalca...</option>
        <option value="${match.player1Id}">${match.player1Name}</option>
        <option value="${match.player2Id}">${match.player2Name}</option>
    `;

    ['resultSet1Winner','resultSet1Loser','resultSet2Winner','resultSet2Loser','resultSet3Winner','resultSet3Loser'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    
    modal.classList.remove('hidden');
};

window.closeResultModal = function() {
    document.getElementById('resultModal').classList.add('hidden');
    currentScheduledMatchId = null;
    if (window.renderSelects) window.renderSelects();
};

// 6. POTRDITEV REZULTATA
window.submitMatchResult = async function() {
    if (!currentScheduledMatchId) return;

    const scheduleId = currentScheduledMatchId;
    const match = scheduledMatchesData.find(m => m.docId === scheduleId);
    
    const winnerId = document.getElementById('resultWinner').value;
    if(winnerId === '0') {
        alert('Izberi zmagovalca!');
        return;
    }
    
    const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
    const matchType = document.getElementById('resultMatchType').value;
    
    const scores = [];
    for(let i=1; i<=3; i++) {
        const w = document.getElementById(`resultSet${i}Winner`).value;
        const l = document.getElementById(`resultSet${i}Loser`).value;
        if(w !== '' && l !== '') scores.push(`${w}-${l}`);
    }
    
    if(scores.length === 0 && matchType !== 'draw') {
        alert('Vpiši rezultat vsaj enega seta.');
        return;
    }

    try {
        const { getFirestore, collection, addDoc, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        
        let db = window.firebaseDb;
        if (!db && window.firebaseApp) db = getFirestore(window.firebaseApp);

        // 1. Dodaj v odigrane tekme
        await addDoc(collection(db, 'tenis_matches'), {
            id: Date.now(),
            date: match.scheduledDate, 
            winnerId, 
            loserId,
            winnerName: playersData.find(p => p.id === winnerId).name,
            loserName: playersData.find(p => p.id === loserId).name,
            score: scores.join(', '),
            surface: match.surface,
            type: matchType
        });

        // 2. Označi načrtovano tekmo kot zaključeno
        await updateDoc(doc(db, 'scheduled_matches', scheduleId), { status: 'completed' });

        closeResultModal();
        if (window.showMessage) window.showMessage('Rezultat shranjen in tekma zaključena!', 'success');

    } catch (e) {
        console.error("Napaka pri shranjevanju rezultata:", e);
        alert(`Napaka: ${e.message}`);
    }
};

// Export funkcij
window.toggleCreateMatchForm = toggleCreateMatchForm;
window.createNewScheduledMatch = createNewScheduledMatch;
window.renderScheduledMatches = renderScheduledMatches;