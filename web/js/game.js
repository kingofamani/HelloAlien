document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const screens = {
        lobby: document.getElementById('lobby-screen'),
        join: document.getElementById('join-screen'),
        game: document.getElementById('game-play-screen'),
        over: document.getElementById('game-over-screen'),
    };
    const newGameBtn = document.getElementById('new-game-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    const restartGameBtn = document.getElementById('restart-game-btn');
    const qrCodeContainer = document.getElementById('qrcode');
    const mobileUrl = document.getElementById('mobile-url');
    const greenTeamPlayers = document.getElementById('green-team-players');
    const whiteTeamPlayers = document.getElementById('white-team-players');
    const scoreGreen = document.getElementById('score-green');
    const scoreWhite = document.getElementById('score-white');
    const alienGreen = document.getElementById('alien-green');
    const alienWhite = document.getElementById('alien-white');
    const winnerAnnouncement = document.getElementById('winner-announcement');
    const feedbackGreen = document.getElementById('feedback-green');
    const feedbackWhite = document.getElementById('feedback-white');

    // --- Game State ---
    let mqttClient = null;
    const players = {}; // { playerId: { team: 'green' | 'white', name: 'PlayerName' } }
    let scores = { green: 0, white: 0 };
    const winningScore = 2500;
    let gameInterval = null;
    let lastRhythmEventTime = 0;

    // --- MQTT Config ---
    const MQTT_BROKER = 'broker.emqx.io';
    const MQTT_PORT = 8084; // WebSocket Secure
    const MQTT_TOPIC = 'cKxVnZuPyW/all';

    // --- Functions ---

    function switchScreen(screenName) {
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    function connectMQTT() {
        const clientId = 'game-host-' + Math.random().toString(16).substr(2, 8);
        mqttClient = mqtt.connect(`wss://${MQTT_BROKER}:${MQTT_PORT}/mqtt`, { clientId });

        mqttClient.on('connect', () => {
            console.log('MQTT (WSS) connected!');
            mqttClient.subscribe(MQTT_TOPIC, (err) => {
                if (err) {
                    console.error('Subscription error:', err);
                } else {
                    console.log(`Subscribed to ${MQTT_TOPIC}`);
                }
            });
        });

        mqttClient.on('message', (topic, message) => {
            handleMQTTMessage(JSON.parse(message.toString()));
        });
    }

    function handleMQTTMessage(msg) {
        console.log('Received message:', msg);
        const { type, playerId, timestamp, name } = msg;

        if (type === 'join' && !players[playerId]) {
            addPlayer(playerId, name);
        } else if (type === 'move' && players[playerId] && timestamp) {
            handlePlayerMove(playerId, timestamp);
        }
    }
    
    function addPlayer(playerId, name) {
        const greenCount = Object.values(players).filter(p => p.team === 'green').length;
        const whiteCount = Object.values(players).filter(p => p.team === 'white').length;
        
        const team = greenCount <= whiteCount ? 'green' : 'white';
        players[playerId] = { team, name: name || `Player ${playerId.substring(0,4)}` };
        
        const playerElement = document.createElement('li');
        playerElement.textContent = players[playerId].name;
        
        if (team === 'green') {
            greenTeamPlayers.appendChild(playerElement);
        } else {
            whiteTeamPlayers.appendChild(playerElement);
        }
        
        startGameBtn.disabled = false;
        console.log(`Player ${playerId} joined ${team} team.`);
    }

    function startGame() {
        switchScreen('game');
        scores = { green: 0, white: 0 };
        updateScores();
        lastRhythmEventTime = 0;
        
        // Publish game start message
        mqttClient.publish(MQTT_TOPIC, JSON.stringify({ type: 'game_start' }));

        // Start alien animation loop
        const rhythmSpeed = 1200;
        let lastPosition = 0;

        gameInterval = setInterval(() => {
            const now = Date.now();
            // Sine wave for movement
            const currentPosition = Math.sin(now * 2 * Math.PI / rhythmSpeed); // -1 to 1
            
            // 改為在波形的底點 (從下降變為上升) 更新節奏點
            if (lastPosition < 0 && currentPosition >= 0) {
                lastRhythmEventTime = now;
                console.log(`Rhythm event (BOTTOM) at: ${now}`);
            }

            // Map position to CSS 'top' property
            // 擺動範圍從 10% 到 90%
            const topPercent = 50 - currentPosition * 40;
            
            // 使用 calc() 來減去外星人自身高度的一半 (50px)，確保其中心點在範圍內
            // 這樣它的頂部範圍約在 10% - 50px, 底部範圍約在 90% + 50px
            alienGreen.style.top = `calc(${topPercent}% - 50px)`;
            alienWhite.style.top = `calc(${topPercent}% - 50px)`;

            lastPosition = currentPosition;

        }, 20); // 高頻率更新以確保動畫和偵測流暢
    }
    
    function handlePlayerMove(playerId, moveTimestamp) {
        if (!gameInterval || lastRhythmEventTime === 0) return;

        const player = players[playerId];
        if (!player) return;

        // 引入 config.js 的設定
        const offset = typeof TIME_OFFSET !== 'undefined' ? TIME_OFFSET : 0;
        const timingWindow = typeof TIMING_RANGE !== 'undefined' ? TIMING_RANGE : 250;

        // 計算原始時間差
        const rawDiff = moveTimestamp - lastRhythmEventTime;
        // 校準時間差
        const calibratedDiff = Math.abs(rawDiff - offset);

        console.log(`Player ${playerId} moved. Calibrated diff: ${calibratedDiff}ms (Raw: ${rawDiff}ms, Offset: ${offset}ms)`);

        // 必須在有效的時間窗口內
        if (calibratedDiff <= timingWindow) {
            // 分數計算：差距越小，分數越高
            const points = Math.round((1 - (calibratedDiff / timingWindow)) * 150); // 滿分 150
            scores[player.team] += points;
            
            console.log(`  -> SYNC! +${points} points for team ${player.team}.`);
            
            // 在得分時才顯示回饋
            showFeedback(player, calibratedDiff, points);

            updateScores();
            checkWinner();
        } else {
            // 如果不同步，可以選擇顯示 'Miss' 或不做任何事
            // showFeedback(player, 'Miss'); 
            console.log(`  -> Out of sync.`);
        }
    }

    function showFeedback(player, diff, points) {
        const feedbackEl = player.team === 'green' ? feedbackGreen : feedbackWhite;
        
        let message = '';
        if (typeof diff === 'number') {
            const syncQuality = points > 120 ? 'Perfect!' : (points > 80 ? 'Great!' : 'Good');
            message = `${player.name}: ${syncQuality} (+${points})`;
        } else {
            message = `${player.name}: ${diff}`; // 用於顯示 'Miss' 等文字
        }
        
        feedbackEl.textContent = message;
        
        // 使用新的 show class 來觸發動畫
        feedbackEl.classList.add('show');

        // 在 1 秒後移除 class 以便下次觸發
        setTimeout(() => {
            feedbackEl.classList.remove('show');
        }, 1000);
    }

    function updateScores() {
        scoreGreen.textContent = scores.green;
        scoreWhite.textContent = scores.white;
    }

    function checkWinner() {
        let winner = null;
        if (scores.green >= winningScore) {
            winner = '綠隊';
        } else if (scores.white >= winningScore) {
            winner = '白隊';
        }

        if (winner) {
            endGame(winner);
        }
    }

    function endGame(winner) {
        clearInterval(gameInterval);
        gameInterval = null;
        
        mqttClient.publish(MQTT_TOPIC, JSON.stringify({ type: 'game_over', winner }));

        winnerAnnouncement.textContent = `${winner} 獲勝！`;
        switchScreen('over');
    }
    
    function resetGame() {
        Object.keys(players).forEach(p => delete players[p]);
        greenTeamPlayers.innerHTML = '';
        whiteTeamPlayers.innerHTML = '';
        scores = { green: 0, white: 0 };
        updateScores();
        startGameBtn.disabled = true;
        
        // Go back to lobby to generate new QR
        switchScreen('lobby');
    }

    // --- Event Listeners ---
    newGameBtn.addEventListener('click', () => {
        switchScreen('join');
        
        // Generate QR Code for mobile page using config
        const url = `https://${SERVER_IP}:${SERVER_PORT}/mobile/`;
        mobileUrl.textContent = url;
        qrCodeContainer.innerHTML = '';
        new QRCode(qrCodeContainer, {
            text: url,
            width: 256,
            height: 256,
        });
        
        connectMQTT();
    });

    startGameBtn.addEventListener('click', startGame);
    restartGameBtn.addEventListener('click', resetGame);
    
    // --- Initial Setup ---
    switchScreen('lobby');
}); 