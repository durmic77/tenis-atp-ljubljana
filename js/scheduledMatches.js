// Konstante statusov
const SCHEDULED_MATCH_STATUS = {
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// 1. Upravljanje obrazca (Odpiranje/Zapiranje)
function toggleCreateMatchForm() {
    const form = document.getElementById('createMatchForm');
    const btnText = document.getElementById('toggleCreateMatchText');
    
    // Preklop vidnosti
    const isHidden = form.classList.toggle('hidden');
    
    if (isHidden) {
        // Gumb ko je obrazec zaprt
        btnText.innerHTML = `
            <span class="bg-white/20 rounded-full p-1">📅</span>
            Načrtuj Novo Tekmo
        `;
    } else {
        // Gumb ko je obrazec odprt
        btnText.textContent = '✖️ Prekliči vnos';
        setDefaultScheduledDate();
    }
}

// 2. Nastavitev privzetega datuma in ure
function setDefaultScheduledDate() {
    const now = new Date();
    const dateInput = document.getElementById('scheduledDate');
    const timeInput = document.getElementById('scheduledTime');

    if (dateInput && !dateInput.value) {
        dateInput.value = now.toISOString().split('T')[0];
    }
    
    if (timeInput && !timeInput.value) {
        // Nastavi na naslednjo polno uro ali privzeto 18:00
        timeInput.value = '18:00';
    }
}

// 3. SHRANJEVANJE NOVE TEKME (Glavna funkcija)
async function createNewScheduledMatch() {
    console.log("Začenjam shranjevanje termina...");

    // A. Pridobivanje vrednosti iz obrazca
    const player1Id = document.getElementById('scheduledPlayer1').value;
    const player2Id = document.getElementById('scheduledPlayer2').value;
    const date = document.getElementById('scheduledDate').value;
    const time = document.getElementById('scheduledTime').value;
    const court = document.getElementById('scheduledCourt').value;
    const surface = document.getElementById('scheduledSurface').value;
    const matchType = document.getElementById('scheduledMatchType').value;
    const notes = document.getElementById('scheduledNotes').value;

    // B. Validacija (Preverjanje napak)
    if (player1Id === '0' || player2Id === '0') {
        alert('Prosim, izberi oba igralca.');
        return;
    }
    
    if (player1Id === player2Id) {
        alert('Igralec ne more igrati sam s seboj. Izberi različna igralca.');
        return;
    }
    
    if (!date || !time) {
        alert('Datum in ura sta obvezna.');
        return;
    }

    // C. Iskanje podatkov o igralcih
    // Uporabljamo globalno spremenljivko playersData iz core.js
    const p1 = playersData.find(p => p.id === player1Id);
    const p2 = playersData.find(p => p.id === player2Id);

    if (!p1 || !p2) {
        console.error("Napaka: Podatki o igralcu niso najdeni.", { p1, p2, player1Id, player2Id });
        alert('Napaka pri iskanju igralcev. Poskusi osvežiti stran.');
        return;
    }

    // D. Priprava objekta za bazo
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
        createdAt: Date.now() // Timestamp za sortiranje
    };

    // E. Shranjevanje v Firebase
    try {
        // Dinamični import za Firebase funkcijo
        const { addDoc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        
        // Uporaba globalne poti do kolekcije
        const collectionRef = window.getFirestoreCollectionPaths().scheduled_matches;
        
        await addDoc(collectionRef, matchData);
        
        console.log("✅ Uspešno shranjeno!");
        
        // Zapri obrazec in počisti polja
        toggleCreateMatchForm();
        document.getElementById('scheduledCourt').value = '';
        document.getElementById('scheduledNotes').value = '';
        
        // Pokaži obvestilo (če imaš funkcijo showMessage v core.js)
        if (window.showMessage) {
            window.showMessage('Tekma uspešno načrtovana!', 'success');
        } else {
            alert('Tekma uspešno načrtovana!');
        }

    } catch (e) {
        console.error("❌ KRITIČNA NAPAKA pri shranjevanju:", e);
        alert('Prišlo je do napake pri shranjevanju v bazo. Preveri konzolo za podrobnosti.');
    }
}

// 4. IZRIS SEZNAMA NAČRTOVANIH TEKEM
function renderScheduledMatches() {
    const container = document.getElementById('scheduledMatchesList');
    if(!container) return;

    // Filtriraj samo aktivne tekme in jih sortiraj po datumu
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
        // Lepši izpis datuma
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

// 5. PREKLIC TEKME
async function cancelMatch(id) {
    if(!confirm("Ali res želiš preklicati to tekmo?")) return;
    
    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        const matchRef = doc(window.getFirestoreCollectionPaths().scheduled_matches, id);
        
        await updateDoc(matchRef, { status: 'cancelled' });
        
        if (window.showMessage) window.showMessage('Tekma preklicana.', 'info');
    } catch (e) {
        console.error("Napaka pri preklicu:", e);
        alert("Napaka pri preklicu tekme.");
    }
}

// 6. LOGIKA ZA MODAL (Prenos podatkov v vnos rezultata)
let currentScheduledMatchId = null;

window.openResultModal = function(scheduleId) {
    currentScheduledMatchId = scheduleId;
    const match = scheduledMatchesData.find(m => m.docId === scheduleId);
    if (!match) return;

    const modal = document.getElementById('resultModal');
    
    // Izpis info v modalu
    document.getElementById('resultMatchInfo').innerHTML = `
        <div class="font-bold text-white">${match.player1Name} vs ${match.player2Name}</div>
        <div class="text-xs mt-1 text-gray-400">${match.scheduledDate} • ${match.court}</div>
    `;

    // Nastavi dropdown za zmagovalca samo na ta dva igralca
    const winnerSelect = document.getElementById('resultWinner');
    winnerSelect.innerHTML = `
        <option value="0">Izberi zmagovalca...</option>
        <option value="${match.player1Id}">${match.player1Name}</option>
        <option value="${match.player2Id}">${match.player2Name}</option>
    `;

    // Resetiraj polja za rezultat
    ['resultSet1Winner','resultSet1Loser','resultSet2Winner','resultSet2Loser','resultSet3Winner','resultSet3Loser'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    
    // Odpri modal
    modal.classList.remove('hidden');
};

window.closeResultModal = function() {
    document.getElementById('resultModal').classList.add('hidden');
    currentScheduledMatchId = null;
    
    // Resetiraj dropdown nazaj na vse igralce (za ročni vnos)
    if (window.renderSelects) window.renderSelects();
};

// 7. POTRDITEV REZULTATA IZ MODALA
window.submitMatchResult = async function() {
    // Če nimamo ID-ja načrtovane tekme, gre za navaden vnos (ignoriraj to funkcijo, kliče se recordMatch iz core.js? Ne, modal ima svoj gumb)
    // POZOR: Ta funkcija je specifična za modal, ki se odpre iz "Načrtovanih tekem"
    // Če uporabnik uporablja glavno formo na dnu strani, se kliče recordMatch() iz core.js
    
    if (!currentScheduledMatchId) {
        // To je varovalka, če bi kdo klical to funkcijo narobe. 
        // Če modal nima povezanega ID-ja, morda želimo uporabiti logiko iz core.js, 
        // ampak tukaj bomo obravnavali samo zaključevanje načrtovane tekme.
        console.error("Ni ID-ja načrtovane tekme.");
        return;
    }

    const scheduleId = currentScheduledMatchId;
    const match = scheduledMatchesData.find(m => m.docId === scheduleId);
    
    const winnerId = document.getElementById('resultWinner').value;
    if(winnerId === '0') {
        alert('Izberi zmagovalca!');
        return;
    }
    
    const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
    const matchType = document.getElementById('resultMatchType').value;
    
    // Zberi rezultate
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
        const { addDoc, updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        
        // 1. Dodaj v odigrane tekme
        await addDoc(window.getFirestoreCollectionPaths().matches, {
            id: Date.now(),
            date: match.scheduledDate, // Uporabi datum, ko je bila planirana (ali današnji?) - Ponavadi planiran datum.
            winnerId, 
            loserId,
            winnerName: playersData.find(p => p.id === winnerId).name,
            loserName: playersData.find(p => p.id === loserId).name,
            score: scores.join(', '),
            surface: match.surface,
            type: matchType
        });

        // 2. Označi načrtovano tekmo kot zaključeno
        const scheduleRef = doc(window.getFirestoreCollectionPaths().scheduled_matches, scheduleId);
        await updateDoc(scheduleRef, { status: 'completed' });

        closeResultModal();
        if (window.showMessage) window.showMessage('Rezultat shranjen in tekma zaključena!', 'success');

    } catch (e) {
        console.error("Napaka pri shranjevanju rezultata:", e);
        alert("Napaka pri shranjevanju.");
    }
};

// Export funkcij v globalni window scope
window.toggleCreateMatchForm = toggleCreateMatchForm;
window.createNewScheduledMatch = createNewScheduledMatch;
window.renderScheduledMatches = renderScheduledMatches;