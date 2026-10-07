document.addEventListener('DOMContentLoaded', () => {

    // --- ESTADO DEL JUEGO ---
    let boardState = Array(9).fill('');
    let isGameActive = true;
    let playerSymbol = 'X';
    let cpuSymbol = 'O';
    let currentTurn = 'X';
    let starterPreference = 'player';
    let difficulty = 'hard';

    const scores = { player: 0, ties: 0, cpu: 0 };

    const WINNING_COMBINATIONS = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontales
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Verticales
        [0, 4, 8], [2, 4, 6]             // Diagonales
    ];

    // --- REFERENCIAS DOM ---
    const boardEl = document.getElementById('board');
    const cells = document.querySelectorAll('.cell');
    const statusText = document.getElementById('status-text');
    const difficultySelect = document.getElementById('difficulty-select');
    
    const scorePlayerEl = document.getElementById('score-player');
    const scoreTiesEl = document.getElementById('score-ties');
    const scoreCpuEl = document.getElementById('score-cpu');
    const playerLabelEl = document.getElementById('player-score-label');
    const cpuLabelEl = document.getElementById('cpu-score-label');

    const btnCreate = document.getElementById('btn-create');
    const btnRestart = document.getElementById('btn-restart');
    const btnEnd = document.getElementById('btn-end');

    const symbolSelector = document.getElementById('symbol-selector');
    const starterSelector = document.getElementById('starter-selector');

    // --- SINTETIZADOR DE AUDIO ---
    let audioCtx = null;

    function playSound(type) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            const now = audioCtx.currentTime;

            if (type === 'click') {
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'win') {
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.setValueAtTime(659.25, now + 0.1);
                osc.frequency.setValueAtTime(783.99, now + 0.2);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
                osc.start(now);
                osc.stop(now + 0.4);
            } else if (type === 'lose') {
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(150, now + 0.3);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
                osc.start(now);
                osc.stop(now + 0.3);
            }
        } catch (e) {
            // Ignorar errores de audio
        }
    }

    // --- INICIALIZACIÓN Y CONTROL DE PARTIDA ---

    function initGame(resetScore = false) {
        boardState = Array(9).fill('');
        isGameActive = true;

        if (resetScore) {
            scores.player = 0;
            scores.ties = 0;
            scores.cpu = 0;
            updateScoreUI();
        }

        cells.forEach(cell => {
            cell.textContent = '';
            cell.className = 'cell';
            cell.removeAttribute('disabled');
        });

        if (starterPreference === 'player') {
            currentTurn = playerSymbol;
            statusText.textContent = `¡Tu turno! (${playerSymbol})`;
        } else {
            currentTurn = cpuSymbol;
            statusText.textContent = `Turno de la CPU (${cpuSymbol})...`;
            setTimeout(makeCpuMove, 500);
        }
    }

    // Evento de clic en las casillas usando delegación de eventos
    boardEl.addEventListener('click', (e) => {
        const cell = e.target.closest('.cell');
        if (!cell) return;

        const index = parseInt(cell.dataset.index, 10);

        if (boardState[index] !== '' || !isGameActive || currentTurn !== playerSymbol) {
            return;
        }

        executeMove(index, playerSymbol);

        if (isGameActive && currentTurn === cpuSymbol) {
            statusText.textContent = `Pensando jugada...`;
            setTimeout(makeCpuMove, 450);
        }
    });

    function executeMove(index, symbol) {
        boardState[index] = symbol;
        const cell = cells[index];
        cell.textContent = symbol;
        cell.classList.add(symbol.toLowerCase());
        cell.setAttribute('disabled', 'true');

        playSound('click');

        const winData = checkWin(boardState);

        if (winData) {
            endGame(winData);
        } else if (isBoardFull(boardState)) {
            endGame({ winner: 'tie' });
        } else {
            currentTurn = currentTurn === 'X' ? 'O' : 'X';
            if (currentTurn === playerSymbol) {
                statusText.textContent = `¡Tu turno! (${playerSymbol})`;
            }
        }
    }

    function checkWin(board) {
        for (const combo of WINNING_COMBINATIONS) {
            const [a, b, c] = combo;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a], combo };
            }
        }
        return null;
    }

    function isBoardFull(board) {
        return board.every(cell => cell !== '');
    }

    function endGame(result) {
        isGameActive = false;

        if (result.winner === 'tie') {
            statusText.textContent = '¡Empate!';
            scores.ties++;
        } else {
            const isPlayerWin = result.winner === playerSymbol;
            highlightWinningCells(result.combo);

            if (isPlayerWin) {
                statusText.textContent = '🎉 ¡Has ganado!';
                scores.player++;
                playSound('win');
                triggerConfetti();
            } else {
                statusText.textContent = '🤖 La CPU ha ganado.';
                scores.cpu++;
                playSound('lose');
            }
        }

        updateScoreUI();
    }

    function highlightWinningCells(combo) {
        combo.forEach(index => {
            cells[index].classList.add('winner');
        });
    }

    function updateScoreUI() {
        scorePlayerEl.textContent = scores.player;
        scoreTiesEl.textContent = scores.ties;
        scoreCpuEl.textContent = scores.cpu;
    }

    // --- IA / CPU MOVES ---

    function makeCpuMove() {
        if (!isGameActive) return;

        let bestIndex;
        if (difficulty === 'easy') {
            bestIndex = getRandomMove();
        } else if (difficulty === 'medium') {
            bestIndex = Math.random() < 0.5 ? getBestMoveMinimax() : getRandomMove();
        } else {
            bestIndex = getBestMoveMinimax();
        }

        if (bestIndex !== undefined && bestIndex !== null && boardState[bestIndex] === '') {
            executeMove(bestIndex, cpuSymbol);
        }
    }

    function getRandomMove() {
        const available = boardState
            .map((val, idx) => (val === '' ? idx : null))
            .filter(v => v !== null);
        return available.length > 0 ? available[Math.floor(Math.random() * available.length)] : null;
    }

    function getBestMoveMinimax() {
        let bestScore = -Infinity;
        let move = null;

        for (let i = 0; i < 9; i++) {
            if (boardState[i] === '') {
                boardState[i] = cpuSymbol;
                let score = minimax(boardState, 0, false);
                boardState[i] = '';
                if (score > bestScore) {
                    bestScore = score;
                    move = i;
                }
            }
        }
        return move;
    }

    function minimax(board, depth, isMaximizing) {
        const winData = checkWin(board);
        if (winData) {
            return winData.winner === cpuSymbol ? 10 - depth : depth - 10;
        }
        if (isBoardFull(board)) return 0;

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = cpuSymbol;
                    let score = minimax(board, depth + 1, false);
                    board[i] = '';
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = playerSymbol;
                    let score = minimax(board, depth + 1, true);
                    board[i] = '';
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    }

    // --- EFECTO CONFETI ---

    function triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = Array.from({ length: 70 }, () => ({
            x: Math.random() * canvas.width,
            y: -10,
            size: Math.random() * 8 + 4,
            color: ['#38bdf8', '#f43f5e', '#10b981', '#fbbf24', '#a855f7'][Math.floor(Math.random() * 5)],
            speedY: Math.random() * 3 + 2,
            speedX: (Math.random() - 0.5) * 2
        }));

        let animationFrame;
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.speedY;
                p.x += p.speedX;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            });

            if (particles.some(p => p.y < canvas.height)) {
                animationFrame = requestAnimationFrame(render);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrame);
            }
        };
        render();
    }

    // --- CONTROLES Y CONFIGURACIÓN ---

    btnCreate.addEventListener('click', () => initGame(false));
    btnRestart.addEventListener('click', () => initGame(false));
    btnEnd.addEventListener('click', () => {
        if (confirm('¿Deseas terminar la partida y reiniciar el marcador a 0?')) {
            initGame(true);
        }
    });

    difficultySelect.addEventListener('change', (e) => {
        difficulty = e.target.value;
        initGame(false);
    });

    symbolSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-toggle');
        if (!btn) return;
        symbolSelector.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        playerSymbol = btn.dataset.symbol;
        cpuSymbol = playerSymbol === 'X' ? 'O' : 'X';

        playerLabelEl.textContent = `Jugador (${playerSymbol})`;
        cpuLabelEl.textContent = `CPU (${cpuSymbol})`;

        initGame(false);
    });

    starterSelector.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-toggle');
        if (!btn) return;
        starterSelector.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        starterPreference = btn.dataset.starter;
        initGame(false);
    });

    // Iniciar
    initGame(true);
});