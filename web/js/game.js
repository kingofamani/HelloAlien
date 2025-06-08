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

    // --- Game State ---
    let mqttClient = null;
    const players = {}; // { playerId: { team: 'green' | 'white' } }
    let scores = { green: 0, white: 0 };
    const winningScore = 1000;
    let gameInterval = null;

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
        const { type, playerId } = msg;

        if (type === 'join' && !players[playerId]) {
            addPlayer(playerId);
        } else if (type === 'move' && players[playerId]) {
            handlePlayerMove(playerId);
        }
    }
    
    function addPlayer(playerId) {
        const greenCount = Object.values(players).filter(p => p.team === 'green').length;
        const whiteCount = Object.values(players).filter(p => p.team === 'white').length;
        
        const team = greenCount <= whiteCount ? 'green' : 'white';
        players[playerId] = { team };
        
        const playerElement = document.createElement('li');
        playerElement.textContent = `玩家 ${playerId.substring(0, 4)}`;
        
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
        
        // Publish game start message
        mqttClient.publish(MQTT_TOPIC, JSON.stringify({ type: 'game_start' }));

        // Start alien animation loop
        const rhythmSpeed = 1000; // ms for a full up-down cycle
        gameInterval = setInterval(() => {
            const now = Date.now();
            // Simple sine wave for movement
            const position = Math.sin(now * 2 * Math.PI / rhythmSpeed); // -1 to 1
            
            // Map position to CSS 'top' property. e.g., 40% to 60%
            const topPercent = 50 + position * 10;
            
            alienGreen.style.top = `${topPercent}%`;
            alienWhite.style.top = `${topPercent}%`;

        }, 50); // High-frequency update for smooth animation
    }
    
    function handlePlayerMove(playerId) {
        if (!gameInterval) return; // Game not started

        const player = players[playerId];
        if (!player) return;

        const rhythmSpeed = 1000;
        const now = Date.now();
        const expectedPhase = (now % rhythmSpeed) / rhythmSpeed; // 0 to 1
        
        // Let's assume a 'move' should happen at the bottom of the cycle (phase ~0.75)
        const timeDiff = Math.abs(expectedPhase - 0.75);
        
        // Closer to 0 is better
        if (timeDiff < 0.1 || timeDiff > 0.9) { // Generous timing window
            const points = Math.round((0.1 - Math.min(timeDiff, 1 - timeDiff)) * 1000); // Max 100 points
            scores[player.team] += points;
            updateScores();
            checkWinner();
        }
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