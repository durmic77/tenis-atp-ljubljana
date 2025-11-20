// Upravljanje forme za ustvarjanje tekem
const SCHEDULED_MATCH_STATUS = {
    SCHEDULED: 'scheduled',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

function toggleCreateMatchForm() {
    const form = document.getElementById('createMatchForm');
    const btnText = document.getElementById('toggleCreateMatchText');
    const isHidden = form.classList.toggle('hidden');
    
    if (isHidden) {
        btnText.innerHTML = `<span class="bg-white/20 rounded-full p-1"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg></span> Načrtuj Novo Tekmo`;
    } else {
        btnText.textContent = '✖️ Zapri obrazec';
        setDefaultScheduledDate();
    }
}

function setDefaultScheduledDate() {
    const now = new Date();
    const dateInput = document.getElementById('scheduledDate');
    if (dateInput) dateInput.value = now.toISOString().split('T')[0];
    
    const timeInput = document.getElementById('scheduledTime');
    if (timeInput && !timeInput.value) timeInput.value = '18:00';
}

async function createNewScheduledMatch() {
    const player1Id = document.getElementById('scheduledPlayer1').value;
    const player2Id = document.getElementById('scheduledPlayer2').value;
    const date = document.getElementById('scheduledDate').value;
    const time = document.getElementById('scheduledTime').value;
    const court = document.getElementById('scheduledCourt').value;
    const surface = document.getElementById('scheduledSurface').value;
    const matchType = document.getElementById('scheduledMatchType').value;
    const notes = document.getElementById('scheduledNotes').value;

    if (player1Id === '0' || player2Id === '0') return alert('Izberi oba igralca');
    if (player1Id === player2Id) return alert('Igralca morata biti različna');
    if (!date || !time) return alert('Določi datum in uro');
    
    const p1 = playersData.find(p => p.id === player1Id);
    const p2 = playersData.find(p => p.id === player2Id);

    const matchData = {
        player1Id, player2Id,
        player1Name: p1.name, player2Name: p2.name,
        scheduledDate: date, scheduledTime: time,
        court: court || 'Teren ?', surface, matchType, notes,
        status: SCHEDULED_MATCH_STATUS.SCHEDULED,
        createdAt: Date.now()
    };

    try {
        const { addDoc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
        await addDoc(window.getFirestoreCollectionPaths().scheduled_matches, matchData);
        
        toggleCreateMatchForm();
        // Clean form
        document.getElementById('scheduledCourt').value = '';
        document.getElementById('scheduledNotes').value = '';
    } catch (e) {
        console.error(e);
        alert('Napaka pri shranjevanju');
    }
}

function renderScheduledMatches() {
    const container = document.getElementById('scheduledMatchesList');
    if(!container) return;

    const activeMatches = scheduledMatchesData
        .filter(m => m.status === SCHEDULED_MATCH_STATUS.SCHEDULED)
        .sort((a, b) => new Date(a.scheduledDate + 'T' + a.scheduledTime) - new Date(b.scheduledDate + 'T' + b.scheduledTime));
    
    if (activeMatches.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 text-sm italic py-2">Ni prihajajočih tekem.</div>';
        return;
    }
    
    container.innerHTML = activeMatches.map(match => {
        const dateObj = new Date(match.scheduledDate);
        const dateStr = dateObj.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' });
        
        return `
            <div class="bg-gray-700/40 border-l-4 border-blue-500 rounded p-3 flex justify-between items-center group hover:bg-gray-700 transition">
                <div class="flex-1">
                    <div class="font-bold text-white text-sm md:text-base">
                        ${match.player1Name} <span class="text-blue-400 text-xs">vs</span> ${match.player2Name}
                    </div>
                    <div class="text-xs text-gray-400 mt-1 flex items-center gap-2">
                        <span class="text-gray-300">📅 ${dateStr} ob ${match.scheduledTime}</span>
                        <span>•</span>
                        <span>${match.court}</span>
                    </div>
                    ${match.notes ? `<div class="text-[10px] text-gray-500 italic mt-1">${match.notes}</div>` : ''}
                </div>
                <div class="flex flex-col gap-2 pl-3">
                    <button onclick="openResultModal('${match.docId}')" class="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-2 rounded font-medium shadow">
                        Vpiši
                    </button>
                    <button onclick="cancelMatch('${match.docId}')" class="text-red-400 hover:text-red-300 text-xs px-2">
                        Prekliči
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function cancelMatch(id) {
    if(!confirm("Preklic tekme?")) return;
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
    await updateDoc(doc(window.getFirestoreCollectionPaths().scheduled_matches, id), { status: 'cancelled' });
}

// Modal logic for converting scheduled to real match
let currentScheduledMatchId = null;

window.openResultModal = function(scheduleId) {
    currentScheduledMatchId = scheduleId;
    const match = scheduledMatchesData.find(m => m.docId === scheduleId);
    if (!match) return;

    const modal = document.getElementById('resultModal');
    document.getElementById('resultMatchInfo').innerHTML = `
        <div class="font-bold">${match.player1Name} vs ${match.player2Name}</div>
        <div class="text-xs mt-1">${match.scheduledDate} | ${match.court}</div>
    `;

    const winnerSelect = document.getElementById('resultWinner');
    winnerSelect.innerHTML = `
        <option value="0">Izberi...</option>
        <option value="${match.player1Id}">${match.player1Name}</option>
        <option value="${match.player2Id}">${match.player2Name}</option>
    `;

    // Reset inputs
    ['resultSet1Winner','resultSet1Loser','resultSet2Winner','resultSet2Loser','resultSet3Winner','resultSet3Loser'].forEach(id => {
        document.getElementById(id).value = '';
    });

    modal.classList.remove('hidden');
};

window.closeResultModal = function() {
    document.getElementById('resultModal').classList.add('hidden');
    currentScheduledMatchId = null;
};

window.submitMatchResult = async function() {
    const scheduleId = currentScheduledMatchId;
    const match = scheduledMatchesData.find(m => m.docId === scheduleId);
    
    const winnerId = document.getElementById('resultWinner').value;
    if(winnerId === '0') return alert('Izberi zmagovalca');
    
    const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
    const matchType = document.getElementById('resultMatchType').value;
    
    // Gather scores
    const scores = [];
    for(let i=1; i<=3; i++) {
        const w = document.getElementById(`resultSet${i}Winner`).value;
        const l = document.getElementById(`resultSet${i}Loser`).value;
        if(w !== '' && l !== '') scores.push(`${w}-${l}`);
    }
    
    if(scores.length === 0) return alert('Vpiši vsaj en set');

    // 1. Record Match
    const { addDoc, updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js");
    
    await addDoc(window.getFirestoreCollectionPaths().matches, {
        id: Date.now(),
        date: match.scheduledDate, // Use scheduled date or today? Usually actual played date
        winnerId, loserId,
        winnerName: playersData.find(p => p.id === winnerId).name,
        loserName: playersData.find(p => p.id === loserId).name,
        score: scores.join(', '),
        surface: match.surface,
        type: matchType
    });

    // 2. Mark scheduled as completed
    await updateDoc(doc(window.getFirestoreCollectionPaths().scheduled_matches, scheduleId), { status: 'completed' });

    closeResultModal();
    showMessage('Rezultat shranjen in tekma zaključena!', 'success');
};

window.toggleCreateMatchForm = toggleCreateMatchForm;
window.createNewScheduledMatch = createNewScheduledMatch;
window.renderScheduledMatches = renderScheduledMatches;