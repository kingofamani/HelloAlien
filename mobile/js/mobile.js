document.addEventListener('DOMContentLoaded', () => {
    
    // --- DOM Elements ---
    const joinBtn = document.getElementById('join-btn');
    const statusMessage = document.getElementById('status-message');
    const permissionStatusEl = document.getElementById('permission-status');
    const totalAccelEl = document.getElementById('total-accel');
    const thresholdInfoEl = document.getElementById('threshold-info');
    const bodyEl = document.body;

    // --- Game State ---
    let mqttClient = null;
    let playerId = 'player-' + Math.random().toString(16).substr(2, 8);
    let motionPermissionGranted = false;
    let gameStarted = false;
    const THRESHOLD = 15; // 觸發擺動的總加速度閾值
    let lastMoveTime = 0;
    
    // --- MQTT Config ---
    const MQTT_BROKER = 'broker.emqx.io';
    const MQTT_PORT = 8084; // WebSocket Secure
    const MQTT_TOPIC = 'cKxVnZuPyW/all';

    // --- Functions ---
    
    function connectMQTT() {
        mqttClient = mqtt.connect(`wss://${MQTT_BROKER}:${MQTT_PORT}/mqtt`, { clientId: playerId });

        mqttClient.on('connect', () => {
            console.log('MQTT (WSS) connected!');
            statusMessage.textContent = '連線成功！';
            
            // Subscribe to get game state updates
            mqttClient.subscribe(MQTT_TOPIC, (err) => {
                if (err) console.error('Subscription error:', err);
            });

            // Send join request
            mqttClient.publish(MQTT_TOPIC, JSON.stringify({ type: 'join', playerId }));
            joinBtn.classList.add('hidden');
            statusMessage.textContent = '已加入遊戲，等待主持人開始...';
        });

        mqttClient.on('message', (topic, message) => {
            handleMQTTMessage(JSON.parse(message.toString()));
        });
    }

    function handleMQTTMessage(msg) {
        if (msg.type === 'game_start') {
            gameStarted = true;
            statusMessage.textContent = '遊戲開始！跟著節奏動！';
        } else if (msg.type === 'game_over') {
            gameStarted = false;
            statusMessage.textContent = `遊戲結束！ ${msg.winner} 獲勝！`;
            // Consider stopping motion listener here if battery is a concern
        }
    }

    function requestMotionPermission() {
        statusMessage.textContent = '正在請求權限...';
        permissionStatusEl.textContent = '請求中...';
        thresholdInfoEl.textContent = THRESHOLD;

        if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
            // iOS 13+
            DeviceMotionEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        permissionStatusEl.textContent = '已允許';
                        motionPermissionGranted = true;
                        window.addEventListener('devicemotion', handleMotionEvent);
                        connectMQTT();
                    } else {
                        permissionStatusEl.textContent = '已拒絕';
                        statusMessage.textContent = '請允許動作感應器權限才能開始遊戲。';
                    }
                })
                .catch((error) => {
                    console.error(error);
                    permissionStatusEl.textContent = `錯誤: ${error.message}`;
                });
        } else {
            // Non-iOS 13+ devices (e.g., Android)
            // No explicit permission needed, just add the listener
            permissionStatusEl.textContent = '不需請求 (Android)';
            motionPermissionGranted = true;
            window.addEventListener('devicemotion', handleMotionEvent);
            connectMQTT();
        }
    }
    
    function handleMotionEvent(event) {
        if (!motionPermissionGranted) return;

        // 使用 acceleration (排除重力)
        const { acceleration } = event;
        if (!acceleration || !acceleration.x) {
            totalAccelEl.textContent = '感應器數據無效';
            return;
        }

        // 計算三軸加速度的總和
        const totalAcceleration = Math.abs(acceleration.x) + Math.abs(acceleration.y) + Math.abs(acceleration.z);
        totalAccelEl.textContent = totalAcceleration.toFixed(2);

        if (!gameStarted) return;
        
        const now = Date.now();
        const cooldown = 250; // ms

        // 當總加速度超過閾值，且不在冷卻時間內
        if (totalAcceleration > THRESHOLD && (now - lastMoveTime > cooldown)) {
            lastMoveTime = now;
            console.log(`Move detected! Total: ${totalAcceleration.toFixed(2)}`);
            
            // 觸覺與視覺回饋
            if (navigator.vibrate) {
                navigator.vibrate(50); // 震動 50ms
            }
            bodyEl.classList.add('flash');
            setTimeout(() => bodyEl.classList.remove('flash'), 200);

            // 發送訊息
            mqttClient.publish(MQTT_TOPIC, JSON.stringify({ type: 'move', playerId }));
        }
    }

    // --- Event Listeners ---
    joinBtn.addEventListener('click', requestMotionPermission);

}); 