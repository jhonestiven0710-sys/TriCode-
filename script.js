// ============================================================
// triCode — Lógica del juego
// Requiere: index.html (estructura), style.css (diseño)
// ============================================================

// ---------- SERVICE WORKER (modo offline) ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

// ---------- ELEMENTOS ----------
    const usernameInput = document.getElementById('username');
    const username2Input = document.getElementById('username2');
    const localNameGroup = document.getElementById('local-name-group');
    const roomCodeInput = document.getElementById('room-code-input');

    const btnCreate = document.getElementById('btn-create');
    const btnJoin = document.getElementById('btn-join');
    const btnLocal = document.getElementById('btn-local');
    const localSetup = document.getElementById('local-setup');
    const btnLocalStart = document.getElementById('btn-local-start');
    const btnRestart = document.getElementById('btn-restart');
    const btnLeave = document.getElementById('btn-leave');

    const menuScreen = document.getElementById('menu-screen');
    const playScreen = document.getElementById('play-screen');
    const gameScreen = document.getElementById('game-screen');

    const avatarCircle = document.getElementById('avatar-circle');
    const profileNameDisplay = document.getElementById('profile-name-display');
    const btnEditName = document.getElementById('btn-edit-name');
    const btnOpenPlay = document.getElementById('btn-open-play');
    const btnPlayBack = document.getElementById('btn-play-back');
    const roomInfo = document.getElementById('room-info');
    const displayRoomCode = document.getElementById('display-room-code');
    const statusText = document.getElementById('status-text');
    const turnStatus = document.getElementById('turn-status');
    const boardEl = document.getElementById('board');
    const cells = Array.from(document.querySelectorAll('.cell'));
    const scoreXEl = document.getElementById('score-x');
    const scoreOEl = document.getElementById('score-o');
    const scoreDEl = document.getElementById('score-d');
    const roundIndicator = document.getElementById('round-indicator');
    const labelXEl = document.getElementById('label-x');
    const labelOEl = document.getElementById('label-o');

    const btnHistory = document.getElementById('btn-history');
    const btnHistoryBack = document.getElementById('btn-history-back');
    const btnHistoryClear = document.getElementById('btn-history-clear');
    const historyScreen = document.getElementById('history-screen');
    const historyListEl = document.getElementById('history-list');

    const btnShop = document.getElementById('btn-shop');
    const btnShopBack = document.getElementById('btn-shop-back');
    const shopScreen = document.getElementById('shop-screen');
    const shopListEl = document.getElementById('shop-list');
    const gemBadge = document.getElementById('gem-badge');
    const gemCountEl = document.getElementById('gem-count');
    const gemCountShopEl = document.getElementById('gem-count-shop');

    const WIN_COMBOS = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];

    // Config de conexión: incluye STUN + TURN para que la sala conecte
    // incluso cuando los dos dispositivos están en redes distintas (datos móviles,
    // wifis distintas, redes con NAT restrictivo, etc.)
    const PEER_CONFIG = {
        debug: 0,
        config: {
            iceServers: [
                { urls: 'stun:stun.relay.metered.ca:80' },
                { urls: 'turn:global.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
                { urls: 'turn:global.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
                { urls: 'turn:global.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
            ]
        }
    };

    // ---------- ESTADO ----------
    let mode = null;           // 'online-host' | 'online-guest' | 'local'
    let peer = null;
    let conn = null;
    let roomCode = null;
    let mySymbol = null;       // online
    let localNames = { X: 'Jugador 1', O: 'Jugador 2' };
    let opponentName = null;

    let board = Array(9).fill(null);
    let currentTurn = 'X';
    let gameActive = false;
    let scores = { X: 0, O: 0, D: 0 };

    // ---------- FICHAS / TEMAS / GEMAS ----------
    const THEMES = {
        classic:    { name: 'Clásico',   X: 'X',  O: 'O',  rarity: 'common',    cost: 0 },
        elemental:  { name: 'Elemental', X: '🔥', O: '💧', rarity: 'common',    cost: 0 },
        space:      { name: 'Espacial',  X: '⭐', O: '🌙', rarity: 'common',    cost: 0 },
        animals:    { name: 'Salvaje',   X: '🐱', O: '🐶', rarity: 'common',    cost: 0 },
        thunder:    { name: 'Tormenta',  X: '⚡', O: '☠️', rarity: 'rare',      cost: 30 },
        fruit:      { name: 'Frutal',    X: '🍎', O: '🍋', rarity: 'rare',      cost: 45 },
        royal:      { name: 'Corona',    X: '👑', O: '💎', rarity: 'special',   cost: 100 },
        mythic:     { name: 'Mítico',    X: '🐉', O: '🦄', rarity: 'special',   cost: 140 },
        cosmic:     { name: 'Cósmico',   X: '🌌', O: '☄️', rarity: 'legendary', cost: 300 }
    };

    const RARITY_LABELS = { common: 'Gratis', rare: 'Rara', special: 'Especial', legendary: 'Legendaria' };
    const RARITY_ORDER = ['common', 'rare', 'special', 'legendary'];

    function getUnlockedThemes() {
        try {
            const stored = JSON.parse(localStorage.getItem('tricode_unlocked'));
            if (Array.isArray(stored) && stored.length) return stored;
        } catch (e) {}
        const free = Object.keys(THEMES).filter(k => THEMES[k].cost === 0);
        localStorage.setItem('tricode_unlocked', JSON.stringify(free));
        return free;
    }

    function saveUnlockedThemes(list) {
        localStorage.setItem('tricode_unlocked', JSON.stringify(list));
    }

    function getGems() {
        return parseInt(localStorage.getItem('tricode_gems') || '0', 10);
    }

    function setGems(amount) {
        localStorage.setItem('tricode_gems', String(amount));
        gemCountEl.textContent = amount;
        gemCountShopEl.textContent = amount;
    }

    function awardGems(amount) {
        if (amount <= 0) return;
        setGems(getGems() + amount);
        [gemBadge].forEach(el => {
            el.classList.remove('bump');
            void el.offsetWidth;
            el.classList.add('bump');
        });
    }

    let currentTheme = localStorage.getItem('tricode_theme') || 'classic';
    if (!getUnlockedThemes().includes(currentTheme)) currentTheme = 'classic';

    function symbolFor(key) {
        return THEMES[currentTheme][key];
    }

    function selectTheme(key) {
        currentTheme = key;
        localStorage.setItem('tricode_theme', key);
        updateThemeLabels();
        renderBoard();
    }

    function updateThemeLabels() {
        labelXEl.textContent = symbolFor('X');
        labelOEl.textContent = symbolFor('O');
    }

    function applyThemeUI() {
        updateThemeLabels();
        setGems(getGems());
    }

    function renderShop() {
        const unlocked = getUnlockedThemes();
        const gems = getGems();
        let html = '';
        RARITY_ORDER.forEach(rarity => {
            const keysInRarity = Object.keys(THEMES).filter(k => THEMES[k].rarity === rarity);
            if (!keysInRarity.length) return;
            html += `<div class="shop-section-title">${RARITY_LABELS[rarity]}</div>`;
            keysInRarity.forEach(key => {
                const t = THEMES[key];
                const owned = unlocked.includes(key);
                const equipped = key === currentTheme;
                let btnHtml;
                if (equipped) {
                    btnHtml = `<button class="shop-item-btn equipped-btn" disabled>✓ Equipada</button>`;
                } else if (owned) {
                    btnHtml = `<button class="shop-item-btn equip" data-action="equip" data-key="${key}">Usar</button>`;
                } else {
                    const canBuy = gems >= t.cost;
                    btnHtml = `<button class="shop-item-btn buy" data-action="buy" data-key="${key}" ${canBuy ? '' : 'disabled'}>💎 ${t.cost}</button>`;
                }
                html += `
                    <div class="shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}">
                        <div class="shop-item-icon">${t.X}/${t.O}</div>
                        <div class="shop-item-info">
                            <div class="shop-item-name">${t.name} <span class="rarity-chip rarity-${rarity}">${RARITY_LABELS[rarity]}</span></div>
                            <div class="shop-item-cost">${t.cost === 0 ? 'Incluida' : `Cuesta 💎 ${t.cost}`}</div>
                        </div>
                        ${btnHtml}
                    </div>
                `;
            });
        });
        shopListEl.innerHTML = html;

        shopListEl.querySelectorAll('[data-action="buy"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.dataset.key;
                const t = THEMES[key];
                const balance = getGems();
                if (balance < t.cost) return;
                setGems(balance - t.cost);
                const unlockedNow = getUnlockedThemes();
                unlockedNow.push(key);
                saveUnlockedThemes(unlockedNow);
                selectTheme(key);
                vibrate([30, 40, 30, 40, 60]);
                renderShop();
            });
        });

        shopListEl.querySelectorAll('[data-action="equip"]').forEach(btn => {
            btn.addEventListener('click', () => {
                selectTheme(btn.dataset.key);
                renderShop();
            });
        });
    }

    btnShop.addEventListener('click', () => {
        renderShop();
        menuScreen.classList.add('hidden');
        shopScreen.classList.remove('hidden');
    });

    btnShopBack.addEventListener('click', () => {
        shopScreen.classList.add('hidden');
        menuScreen.classList.remove('hidden');
    });

    // ---------- REGISTRO POR DISPOSITIVO ----------
    const savedName = localStorage.getItem('tricode_username');
    if (savedName) usernameInput.value = savedName;

    function enterNameEditMode() {
        profileNameDisplay.classList.add('hidden');
        usernameInput.classList.remove('hidden');
        usernameInput.focus();
        usernameInput.select();
    }

    function exitNameEditMode() {
        const val = usernameInput.value.trim();
        profileNameDisplay.textContent = val || 'Jugador';
        avatarCircle.textContent = val ? val[0].toUpperCase() : '?';
        usernameInput.classList.add('hidden');
        profileNameDisplay.classList.remove('hidden');
    }

    function guardarNombreDispositivo() {
        const nombre = usernameInput.value.trim();
        if (nombre) localStorage.setItem('tricode_username', nombre);
        exitNameEditMode();
    }

    btnEditName.addEventListener('click', enterNameEditMode);
    usernameInput.addEventListener('blur', guardarNombreDispositivo);
    usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') usernameInput.blur();
    });

    if (savedName) {
        exitNameEditMode();
    } else {
        enterNameEditMode();
    }

    // ---------- NAVEGACIÓN: INICIO / JUGAR ----------
    btnOpenPlay.addEventListener('click', () => {
        menuScreen.classList.add('hidden');
        playScreen.classList.remove('hidden');
    });

    btnPlayBack.addEventListener('click', () => {
        playScreen.classList.add('hidden');
        menuScreen.classList.remove('hidden');
    });

    // ---------- SONIDO Y VIBRACIÓN ----------
    let audioCtx = null;
    function getAudioCtx() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) audioCtx = new AC();
        }
        return audioCtx;
    }

    function playTone(freq, duration, type = 'sine', delay = 0) {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + duration + 0.02);
    }

    function playMoveSound() { playTone(520, 0.08, 'square'); }
    function playWinSound() {
        playTone(660, 0.1, 'triangle', 0);
        playTone(880, 0.12, 'triangle', 0.1);
        playTone(1100, 0.16, 'triangle', 0.2);
    }
    function playDrawSound() {
        playTone(300, 0.15, 'sine', 0);
        playTone(240, 0.2, 'sine', 0.12);
    }

    function vibrate(pattern) {
        if (navigator.vibrate) navigator.vibrate(pattern);
    }

    // ---------- HISTORIAL DE PARTIDAS ----------
    function getHistory() {
        try { return JSON.parse(localStorage.getItem('tricode_history')) || []; }
        catch (e) { return []; }
    }

    function saveHistoryEntry(entry) {
        const history = getHistory();
        history.unshift(entry);
        if (history.length > 40) history.length = 40;
        localStorage.setItem('tricode_history', JSON.stringify(history));
    }

    function renderHistory() {
        const history = getHistory();
        if (history.length === 0) {
            historyListEl.innerHTML = '<p class="history-empty">Todavía no tienes partidas registradas. ¡Juega una para empezar tu historial!</p>';
            return;
        }
        historyListEl.innerHTML = history.map(h => {
            let resultClass = 'result-draw';
            if (h.result.includes('Ganaste') || h.result.includes('ganó')) resultClass = 'result-win';
            if (h.result.includes('Perdiste')) resultClass = 'result-lose';
            return `
                <div class="history-item">
                    <div class="h-top">
                        <span>${h.rival}</span>
                        <span class="${resultClass}">${h.result}</span>
                    </div>
                    <div class="h-meta">${h.mode} · ${h.date}</div>
                </div>
            `;
        }).join('');
    }

    btnHistory.addEventListener('click', () => {
        renderHistory();
        menuScreen.classList.add('hidden');
        historyScreen.classList.remove('hidden');
    });

    btnHistoryBack.addEventListener('click', () => {
        historyScreen.classList.add('hidden');
        menuScreen.classList.remove('hidden');
    });

    btnHistoryClear.addEventListener('click', () => {
        if (confirm('¿Borrar todo el historial de partidas? Esta acción no se puede deshacer.')) {
            localStorage.removeItem('tricode_history');
            renderHistory();
        }
    });

    // ---------- UTILIDADES ----------
    function generarCodigoSala() {
        const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let codigo = '';
        for (let i = 0; i < 4; i++) {
            codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        }
        return codigo;
    }

    function obtenerNombreUsuario() {
        const nombre = usernameInput.value.trim();
        if (!nombre) {
            alert('⚠️ Por favor, ingresa tu nombre primero.');
            playScreen.classList.add('hidden');
            menuScreen.classList.remove('hidden');
            enterNameEditMode();
            return null;
        }
        localStorage.setItem('tricode_username', nombre);
        return nombre;
    }

    function setButtonLoading(btn, loading, loadingText) {
        if (loading) {
            btn.dataset.originalHtml = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${loadingText}`;
            btn.disabled = true;
        } else {
            if (btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
            btn.disabled = false;
        }
    }

    // ---------- NAVEGACIÓN DE PANTALLAS ----------
    function mostrarTablero() {
        menuScreen.classList.add('hidden');
        playScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
    }

    function volverAlMenu() {
        gameScreen.classList.add('hidden');
        playScreen.classList.add('hidden');
        menuScreen.classList.remove('hidden');
        roomCodeInput.value = '';
        setButtonLoading(btnCreate, false);
        setButtonLoading(btnJoin, false);
    }

    // ---------- LÓGICA DEL TABLERO ----------
    let roundCount = 0;

    function startNewRound() {
        board = Array(9).fill(null);
        roundCount++;
        currentTurn = (roundCount % 2 === 1) ? 'X' : 'O';
        gameActive = true;
        renderBoard();
        updateStatusText();
        updateRoundIndicator();
        btnRestart.classList.add('hidden');
    }

    function updateRoundIndicator() {
        if (roundIndicator) {
            roundIndicator.textContent = `Ronda ${roundCount}`;
            roundIndicator.classList.toggle('hidden', !mode);
        }
    }

    function resetGameState() {
        scores = { X: 0, O: 0, D: 0 };
        opponentName = null;
        roundCount = 0;
        startNewRound();
        updateScoreBar();
    }

    function renderBoard() {
        cells.forEach((cell, i) => {
            cell.textContent = board[i] ? symbolFor(board[i]) : '';
            cell.classList.remove('x-color', 'o-color', 'win');
            if (board[i] === 'X') cell.classList.add('x-color');
            if (board[i] === 'O') cell.classList.add('o-color');
            cell.disabled = !!board[i];
        });
    }

    function checkWinner() {
        for (const combo of WIN_COMBOS) {
            const [a, b, c] = combo;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a], combo };
            }
        }
        if (board.every(v => v)) return 'draw';
        return null;
    }

    function updateScoreBar() {
        scoreXEl.textContent = scores.X;
        scoreOEl.textContent = scores.O;
        scoreDEl.textContent = scores.D;
    }

    function highlightWinCombo(combo) {
        combo.forEach(i => cells[i].classList.add('win'));
    }

    function celebrateWin(symbol) {
        const emojis = [symbol, '🎉', '✨'];
        for (let i = 0; i < 14; i++) {
            const p = document.createElement('span');
            p.className = 'celebrate-particle';
            p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            p.style.left = Math.random() * 100 + 'vw';
            p.style.animationDelay = (Math.random() * 0.4) + 's';
            p.style.fontSize = (1.1 + Math.random() * 1.2) + 'rem';
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 2200);
        }
    }

    function updateStatusText() {
        turnStatus.classList.remove('pulse');
        if (mode === 'local') {
            statusText.innerHTML = `Turno de <strong>${localNames[currentTurn]}</strong> (${symbolFor(currentTurn)})`;
        } else {
            if (currentTurn === mySymbol) {
                statusText.textContent = 'Tu turno';
            } else {
                statusText.textContent = `Turno de ${opponentName || 'tu rival'}`;
            }
        }
    }

    function endGame(result) {
        gameActive = false;
        cells.forEach(c => c.disabled = true);
        turnStatus.classList.remove('pulse');

        let resultText = '';
        if (result === 'draw') {
            scores.D++;
            statusText.textContent = '🤝 ¡Empate!';
            resultText = 'Empate';
            playDrawSound();
            vibrate([40, 40, 40]);
        } else {
            scores[result.winner]++;
            highlightWinCombo(result.combo);
            playWinSound();
            vibrate([60, 30, 60]);
            celebrateWin(symbolFor(result.winner));
            if (mode === 'local') {
                statusText.innerHTML = `🏆 ¡${localNames[result.winner]} gana! (${symbolFor(result.winner)})`;
                resultText = `${localNames[result.winner]} ganó`;
            } else {
                const gane = result.winner === mySymbol;
                statusText.textContent = gane ? '🏆 ¡Ganaste!' : '💀 Perdiste, tu rival gana.';
                resultText = gane ? 'Ganaste' : 'Perdiste';
                if (gane) {
                    awardGems(2);
                    statusText.innerHTML += ' <span style="color:#67e8f9;">+2 💎</span>';
                }
            }
        }

        if (mode) {
            const rival = mode === 'local' ? `${localNames.X} vs ${localNames.O}` : (opponentName || 'Rival');
            const modeLabel = mode === 'local' ? 'Local' : 'Online';
            saveHistoryEntry({
                rival,
                result: resultText,
                mode: modeLabel,
                date: new Date().toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            });
        }

        updateScoreBar();
        btnRestart.classList.remove('hidden');
    }

    function processMove(index, symbol) {
        if (!gameActive || board[index]) return false;
        board[index] = symbol;
        renderBoard();
        playMoveSound();
        vibrate(15);
        const result = checkWinner();
        if (result) {
            endGame(result);
        } else {
            currentTurn = symbol === 'X' ? 'O' : 'X';
            updateStatusText();
        }
        return true;
    }

    function onCellClick(e) {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        if (!gameActive || board[index]) return;

        if (mode === 'local') {
            processMove(index, currentTurn);
        } else {
            if (mySymbol !== currentTurn) return;
            processMove(index, mySymbol);
            if (conn && conn.open) {
                conn.send({ type: 'move', index, symbol: mySymbol });
            }
        }
    }

    cells.forEach(cell => cell.addEventListener('click', onCellClick));

    // ---------- MODO LOCAL (2 JUGADORES) ----------
    btnLocal.addEventListener('click', () => {
        const nombre = obtenerNombreUsuario();
        if (!nombre) return;
        localNameGroup.classList.remove('hidden');
        localSetup.classList.remove('hidden');
    });

    btnLocalStart.addEventListener('click', () => {
        const nombre1 = obtenerNombreUsuario();
        if (!nombre1) return;
        const nombre2 = username2Input.value.trim() || 'Jugador 2';

        mode = 'local';
        localNames = { X: nombre1, O: nombre2 };
        roomInfo.classList.add('hidden');

        resetGameState();
        mostrarTablero();
        updateStatusText();
    });

    // ---------- MODO ONLINE: CREAR SALA ----------
    btnCreate.addEventListener('click', () => {
        const nombre = obtenerNombreUsuario();
        if (!nombre) return;

        if (typeof Peer === 'undefined') {
            alert('⚠️ No se pudo cargar el módulo de conexión. Revisa tu internet e inténtalo de nuevo.');
            return;
        }

        mode = 'online-host';
        mySymbol = 'X';
        setButtonLoading(btnCreate, true, 'Creando sala...');
        crearPeerHost(0);
    });

    function crearPeerHost(intentos) {
        roomCode = generarCodigoSala();
        const peerId = 'tricode-' + roomCode.toLowerCase();

        if (peer) { try { peer.destroy(); } catch (e) {} }
        peer = new Peer(peerId, PEER_CONFIG);

        peer.on('open', () => {
            setButtonLoading(btnCreate, false);
            resetGameState();
            mostrarTablero();
            displayRoomCode.textContent = roomCode;
            roomInfo.classList.remove('hidden');
            statusText.textContent = 'Comparte el código. Esperando rival...';
            turnStatus.classList.add('pulse');
        });

        peer.on('connection', (incoming) => {
            conn = incoming;
            setupConnection();
        });

        peer.on('error', (err) => {
            if (err.type === 'unavailable-id' && intentos < 5) {
                crearPeerHost(intentos + 1);
            } else {
                setButtonLoading(btnCreate, false);
                alert('⚠️ No se pudo crear la sala. Revisa tu conexión a internet e inténtalo de nuevo.');
                volverAlMenu();
            }
        });
    }

    // ---------- MODO ONLINE: UNIRSE ----------
    btnJoin.addEventListener('click', () => {
        const nombre = obtenerNombreUsuario();
        if (!nombre) return;

        const codigo = roomCodeInput.value.trim().toUpperCase();
        if (codigo.length !== 4) {
            alert('⚠️ Ingresa un código válido de 4 caracteres.');
            return;
        }

        if (typeof Peer === 'undefined') {
            alert('⚠️ No se pudo cargar el módulo de conexión. Revisa tu internet e inténtalo de nuevo.');
            return;
        }

        mode = 'online-guest';
        mySymbol = 'O';
        roomCode = codigo;
        setButtonLoading(btnJoin, true, 'Conectando...');

        if (peer) { try { peer.destroy(); } catch (e) {} }
        peer = new Peer(null, PEER_CONFIG);

        peer.on('open', () => {
            const targetId = 'tricode-' + codigo.toLowerCase();
            conn = peer.connect(targetId, { reliable: true });
            setupConnection();

            conn.on('open', () => {
                setButtonLoading(btnJoin, false);
                resetGameState();
                mostrarTablero();
                displayRoomCode.textContent = codigo;
                roomInfo.classList.remove('hidden');
                conn.send({ type: 'welcome', name: usernameInput.value.trim() });
                updateStatusText();
            });
        });

        peer.on('error', (err) => {
            setButtonLoading(btnJoin, false);
            alert('⚠️ No se encontró esa sala, o hubo un error de conexión. Verifica el código e inténtalo de nuevo.');
            volverAlMenu();
        });
    });

    // ---------- CONEXIÓN P2P ----------
    function setupConnection() {
        conn.on('open', () => {
            conn.send({ type: 'welcome', name: usernameInput.value.trim() });
        });

        conn.on('data', (data) => handleData(data));

        conn.on('close', () => {
            if (gameActive || mode) {
                gameActive = false;
                cells.forEach(c => c.disabled = true);
                turnStatus.classList.remove('pulse');
                statusText.textContent = '⚠️ Tu rival se desconectó.';
                btnRestart.classList.add('hidden');
            }
        });
    }

    function handleData(data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'welcome':
                opponentName = data.name || 'Rival';
                gameActive = true;
                turnStatus.classList.remove('pulse');
                updateStatusText();
                break;

            case 'move':
                processMove(data.index, data.symbol);
                break;

            case 'restart':
                startNewRound();
                break;
        }
    }

    // ---------- REINICIAR / SALIR ----------
    btnRestart.addEventListener('click', () => {
        if (mode !== 'local' && conn && conn.open) {
            conn.send({ type: 'restart' });
        }
        startNewRound();
    });

    btnLeave.addEventListener('click', () => {
        if (conn) { try { conn.close(); } catch (e) {} conn = null; }
        if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
        mode = null;
        gameActive = false;
        roundIndicator.classList.add('hidden');
        localNameGroup.classList.add('hidden');
        localSetup.classList.add('hidden');
        volverAlMenu();
    });

    // ---------- INPUT AUXILIAR ----------
    roomCodeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    roomCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnJoin.click();
    });

    // ---------- INICIALIZACIÓN ----------
    applyThemeUI();
