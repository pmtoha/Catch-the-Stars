
        document.addEventListener('DOMContentLoaded', () => {

            const canvas = document.getElementById('gameCanvas');
            const ctx = canvas.getContext('2d');
            const scoreElement = document.getElementById('score');
            const livesElement = document.getElementById('lives');
            const levelElement = document.getElementById('level');
            const highScoreElement = document.getElementById('highScore');
            const comboDisplay = document.getElementById('comboDisplay');
            const startScreen = document.getElementById('startScreen');
            const gameOverScreen = document.getElementById('gameOverScreen');
            const pausedScreen = document.getElementById('pausedScreen');
            const finalScoreElement = document.getElementById('finalScore');
            const finalLevelElement = document.getElementById('finalLevel');
            const finalComboElement = document.getElementById('finalCombo');
            const finalHighScoreElement = document.getElementById('finalHighScore');
            const newRecordElement = document.getElementById('newRecord');
            const powerUpIndicator = document.getElementById('powerUpIndicator');
            const powerUpName = document.getElementById('powerUpName');
            const powerUpBar = document.getElementById('powerUpBar');
            const startBtn = document.getElementById('startBtn');
            const restartBtn = document.getElementById('restartBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            const resumeBtn = document.getElementById('resumeBtn');
            const quitBtn = document.getElementById('quitBtn');
            const soundBtn = document.getElementById('soundBtn');

            // ---------- High score ----------
            let highScore = parseInt(localStorage.getItem('catchTheStarsHighScore')) || 0;
            highScoreElement.textContent = highScore;

            // ---------- Canvas (with DPI scaling for crisp rendering) ----------
            let W = 0, H = 0;

            function resizeCanvas() {
                const dpr = window.devicePixelRatio || 1;
                W = canvas.offsetWidth;
                H = canvas.offsetHeight;
                canvas.width = W * dpr;
                canvas.height = H * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                basketY = H - 55;
                if (basketX + basketWidth > W) basketX = W - basketWidth;
                initBgStars();
            }

            // ---------- Audio (Web Audio API - no files needed) ----------
            let audioCtx = null;
            let soundOn = true;

            function ensureAudio() {
                if (!audioCtx) {
                    const AC = window.AudioContext || window.webkitAudioContext;
                    if (AC) audioCtx = new AC();
                }
                if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            }

            function playTone(freq, duration, type = 'sine', volume = 0.12, slideTo = null) {
                if (!audioCtx || !soundOn) return;
                const t = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, t);
                if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
                gain.gain.setValueAtTime(volume, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(t);
                osc.stop(t + duration);
            }

            function playNoise(duration = 0.35, volume = 0.25) {
                if (!audioCtx || !soundOn) return;
                const t = audioCtx.currentTime;
                const bufferSize = Math.floor(audioCtx.sampleRate * duration);
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
                const src = audioCtx.createBufferSource();
                src.buffer = buffer;
                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(volume, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
                src.connect(gain);
                gain.connect(audioCtx.destination);
                src.start(t);
            }

            const sounds = {
                catch(combo) {
                    const pitch = 440 + Math.min(combo, 12) * 45;
                    playTone(pitch, 0.12, 'sine', 0.13, pitch * 1.6);
                },
                bomb() {
                    playNoise(0.4, 0.3);
                    playTone(90, 0.4, 'sawtooth', 0.2, 40);
                },
                powerup() {
                    playTone(523, 0.09, 'square', 0.08);
                    setTimeout(() => playTone(659, 0.09, 'square', 0.08), 90);
                    setTimeout(() => playTone(784, 0.14, 'square', 0.08), 180);
                },
                life() {
                    playTone(523, 0.1, 'triangle', 0.12);
                    setTimeout(() => playTone(784, 0.18, 'triangle', 0.12), 110);
                },
                miss() { playTone(220, 0.15, 'sine', 0.05, 120); },
                levelUp() {
                    playTone(659, 0.1, 'triangle', 0.1);
                    setTimeout(() => playTone(880, 0.16, 'triangle', 0.1), 110);
                },
                gameOver() {
                    playTone(440, 0.3, 'sawtooth', 0.1, 220);
                    setTimeout(() => playTone(330, 0.45, 'sawtooth', 0.1, 160), 320);
                }
            };

            function vibrate(pattern) {
                if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
            }

            // ---------- Game state ----------
            let gameRunning = false;
            let gamePaused = false;
            let score = 0;
            let lives = 3;
            let level = 1;
            let combo = 0;
            let bestCombo = 0;
            let comboTimer = 0;
            const COMBO_TIMEOUT = 150; // frames without a catch before combo resets

            const baseBasketWidth = 80;
            const basketHeight = 24;
            let basketWidth = baseBasketWidth;
            let basketX = 0;
            let basketY = 0;
            const basketSpeed = 9;

            let pointerX = null;
            const keys = {};

            let activePowerUp = null;
            let powerUpTimer = 0;
            let powerUpMaxTime = 0;
            const POWERUP_DURATION = 480; // 8 seconds at 60fps

            let fallingObjects = [];
            let particles = [];
            let floatingTexts = [];
            let bgStars = [];
            let objectSpeed = 3;
            let spawnRate = 60;
            let frameCount = 0;
            let shakeAmount = 0;
            let flashAlpha = 0;

            const POWERUP_INFO = {
                wider:  { name: 'Wider Basket',  color: '#4CAF50', icon: '↔' },
                slower: { name: 'Slow Motion',   color: '#2196F3', icon: '▼' },
                shield: { name: 'Shield',        color: '#9C27B0', icon: '🛡' },
                magnet: { name: 'Magnet',        color: '#FF5722', icon: '🧲' },
                double: { name: 'Double Points', color: '#FFC107', icon: '×2' },
                life:   { name: 'Extra Life',    color: '#E91E63', icon: '♥' }
            };

            const getMultiplier = () => Math.min(1 + Math.floor(combo / 5), 5);

            // ---------- Input ----------
            function pointerLocalX(clientX) {
                const rect = canvas.getBoundingClientRect();
                return clientX - rect.left;
            }

            canvas.addEventListener('touchstart', e => {
                e.preventDefault();
                pointerX = pointerLocalX(e.touches[0].clientX);
            }, { passive: false });

            canvas.addEventListener('touchmove', e => {
                e.preventDefault();
                pointerX = pointerLocalX(e.touches[0].clientX);
            }, { passive: false });

            canvas.addEventListener('mousemove', e => {
                pointerX = pointerLocalX(e.clientX);
            });

            window.addEventListener('keydown', e => {
                keys[e.key] = true;
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
                if ((e.key === 'p' || e.key === 'P') && gameRunning) togglePause();
                if (e.key === 'm' || e.key === 'M') toggleSound();
                if (e.key === ' ' && !gameRunning && !startScreen.classList.contains('hidden')) startGame();
            });
            window.addEventListener('keyup', e => { keys[e.key] = false; });

            // Auto-pause when the tab loses focus
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && gameRunning && !gamePaused) togglePause();
            });

            // ---------- Buttons ----------
            startBtn.addEventListener('click', () => { ensureAudio(); startGame(); });
            restartBtn.addEventListener('click', () => { ensureAudio(); startGame(); });
            pauseBtn.addEventListener('click', togglePause);
            resumeBtn.addEventListener('click', togglePause);
            quitBtn.addEventListener('click', quitGame);
            soundBtn.addEventListener('click', () => { ensureAudio(); toggleSound(); });

            function toggleSound() {
                soundOn = !soundOn;
                soundBtn.textContent = soundOn ? '🔊' : '🔇';
            }

            function togglePause() {
                if (!gameRunning) return;
                gamePaused = !gamePaused;
                if (gamePaused) {
                    pausedScreen.classList.remove('hidden');
                } else {
                    pausedScreen.classList.add('hidden');
                    requestAnimationFrame(gameLoop);
                }
            }

            function quitGame() {
                gamePaused = false;
                gameRunning = false;
                pausedScreen.classList.add('hidden');
                startScreen.classList.remove('hidden');
            }

            // ---------- Game objects ----------
            class FallingObject {
                constructor() {
                    this.width = 30;
                    this.height = 30;
                    this.x = Math.random() * (W - this.width);
                    this.y = -this.height;

                    const rand = Math.random();
                    if (rand < 0.6) this.type = 'star';       // 60%
                    else if (rand < 0.85) this.type = 'bomb'; // 25%
                    else this.type = 'powerup';               // 15%

                    if (this.type === 'star') {
                        const starType = Math.random();
                        if (starType < 0.7) { this.starType = 'normal'; this.color = '#FFD700'; }
                        else if (starType < 0.9) { this.starType = 'silver'; this.color = '#DDE4EE'; }
                        else { this.starType = 'golden'; this.color = '#FFA500'; }
                    }

                    if (this.type === 'powerup') {
                        const roll = Math.random();
                        if (roll < 0.30) this.powerUpType = 'wider';
                        else if (roll < 0.52) this.powerUpType = 'slower';
                        else if (roll < 0.70) this.powerUpType = 'shield';
                        else if (roll < 0.85) this.powerUpType = 'magnet';
                        else if (roll < 0.95) this.powerUpType = 'double';
                        else this.powerUpType = 'life';
                        this.color = POWERUP_INFO[this.powerUpType].color;
                        this.icon = POWERUP_INFO[this.powerUpType].icon;
                    }

                    this.speed = objectSpeed + Math.random() * 2;
                    this.rotation = Math.random() * Math.PI * 2;
                    this.rotationSpeed = (Math.random() - 0.5) * 0.08;
                }

                update(timeScale = 1) {
                    this.y += this.speed * timeScale;
                    this.rotation += this.rotationSpeed;

                    // Magnet gently pulls stars sideways toward the basket
                    if (activePowerUp === 'magnet' && this.type === 'star') {
                        const dx = (basketX + basketWidth / 2) - (this.x + this.width / 2);
                        if (Math.abs(dx) < W * 0.6 && this.y < basketY) {
                            this.x += dx * 0.035;
                        }
                    }
                }

                draw() {
                    if (this.type === 'star') this.drawStar();
                    else if (this.type === 'bomb') this.drawBomb();
                    else this.drawPowerUp();
                }

                drawStar() {
                    ctx.save();
                    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
                    ctx.rotate(this.rotation);
                    if (this.starType !== 'normal') {
                        ctx.shadowColor = this.color;
                        ctx.shadowBlur = 12;
                    }
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    const spikes = 5;
                    const outer = this.width / 2;
                    const inner = outer / 2;
                    let rot = -Math.PI / 2;
                    for (let i = 0; i < spikes * 2; i++) {
                        const r = i % 2 === 0 ? outer : inner;
                        ctx.lineTo(Math.cos(rot) * r, Math.sin(rot) * r);
                        rot += Math.PI / spikes;
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }

                drawBomb() {
                    const cx = this.x + this.width / 2;
                    const cy = this.y + this.height / 2;
                    ctx.save();
                    const grad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, this.width / 2);
                    grad.addColorStop(0, '#5a5a5a');
                    grad.addColorStop(1, '#111111');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.arc(cx, cy, this.width / 2 - 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = '#8B4513';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - this.width / 2 + 3);
                    ctx.quadraticCurveTo(cx + 4, cy - 14, cx + 8, cy - 16);
                    ctx.stroke();

                    ctx.fillStyle = frameCount % 10 < 5 ? '#FF4500' : '#FFD700';
                    ctx.shadowColor = '#FF4500';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.arc(cx + 8, cy - 16, 2.5 + Math.random() * 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                drawPowerUp() {
                    const cx = this.x + this.width / 2;
                    const cy = this.y + this.height / 2;
                    ctx.save();
                    const pulse = 1 + 0.08 * Math.sin(frameCount * 0.15);
                    ctx.translate(cx, cy);
                    ctx.scale(pulse, pulse);

                    ctx.shadowColor = this.color;
                    ctx.shadowBlur = 10;
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, 0, this.width / 2 - 3, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 13px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(this.icon, 0, 1);
                    ctx.restore();
                }

                isOffScreen() { return this.y > H; }

                collidesWith() {
                    return this.x < basketX + basketWidth &&
                           this.x + this.width > basketX &&
                           this.y < basketY + basketHeight &&
                           this.y + this.height > basketY;
                }
            }

            class Particle {
                constructor(x, y, color) {
                    this.x = x;
                    this.y = y;
                    this.color = color;
                    this.size = Math.random() * 4 + 2;
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 4 + 1;
                    this.speedX = Math.cos(angle) * speed;
                    this.speedY = Math.sin(angle) * speed - 1.5;
                    this.life = 1;
                }

                update() {
                    this.x += this.speedX;
                    this.y += this.speedY;
                    this.speedY += 0.08; // gravity
                    this.life -= 0.025;
                }

                draw() {
                    ctx.globalAlpha = Math.max(this.life, 0);
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, Math.max(this.size * this.life, 0.5), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1;
                }

                isDead() { return this.life <= 0; }
            }

            class FloatingText {
                constructor(x, y, text, color, size = 16) {
                    this.x = x;
                    this.y = y;
                    this.text = text;
                    this.color = color;
                    this.size = size;
                    this.life = 1;
                }

                update() {
                    this.y -= 0.8;
                    this.life -= 0.02;
                }

                draw() {
                    ctx.save();
                    ctx.globalAlpha = Math.max(this.life, 0);
                    ctx.fillStyle = this.color;
                    ctx.font = `bold ${this.size}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.shadowColor = 'rgba(0,0,0,0.6)';
                    ctx.shadowBlur = 4;
                    ctx.fillText(this.text, this.x, this.y);
                    ctx.restore();
                }

                isDead() { return this.life <= 0; }
            }

            function createParticles(x, y, color, count = 10) {
                if (particles.length > 250) return;
                for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
            }

            // ---------- Background ----------
            function initBgStars() {
                bgStars = [];
                const count = Math.floor(W / 7);
                for (let i = 0; i < count; i++) {
                    bgStars.push({
                        x: Math.random() * W,
                        y: Math.random() * H,
                        size: Math.random() * 1.6 + 0.4,
                        speed: Math.random() * 0.25 + 0.05,
                        phase: Math.random() * Math.PI * 2
                    });
                }
            }

            function drawBackground() {
                ctx.fillStyle = '#ffffff';
                for (const s of bgStars) {
                    s.y += s.speed;
                    if (s.y > H) { s.y = -2; s.x = Math.random() * W; }
                    ctx.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(frameCount * 0.03 + s.phase));
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
            }

            // ---------- Basket ----------
            function roundRectPath(x, y, w, h, r) {
                ctx.beginPath();
                ctx.moveTo(x + r, y);
                ctx.arcTo(x + w, y, x + w, y + h, r);
                ctx.arcTo(x + w, y + h, x, y + h, r);
                ctx.arcTo(x, y + h, x, y, r);
                ctx.arcTo(x, y, x + w, y, r);
                ctx.closePath();
            }

            function updateBasket() {
                let keyboardMove = false;
                if (keys['ArrowLeft'] || keys['a'] || keys['A']) { basketX -= basketSpeed; keyboardMove = true; }
                if (keys['ArrowRight'] || keys['d'] || keys['D']) { basketX += basketSpeed; keyboardMove = true; }
                if (!keyboardMove && pointerX !== null) {
                    const targetX = pointerX - basketWidth / 2;
                    basketX += (targetX - basketX) * 0.25;
                }
                if (basketX < 0) basketX = 0;
                if (basketX + basketWidth > W) basketX = W - basketWidth;
            }

            function drawBasket() {
                const x = basketX, y = basketY, w = basketWidth, h = basketHeight;
                ctx.save();

                if (activePowerUp === 'shield') {
                    const pulse = 0.45 + 0.25 * Math.sin(frameCount * 0.1);
                    ctx.strokeStyle = `rgba(156, 39, 176, ${pulse})`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(x + w / 2, y + h / 2, w / 2 + 14, 0, Math.PI * 2);
                    ctx.stroke();
                }

                if (activePowerUp === 'magnet') {
                    const pulse = 0.3 + 0.2 * Math.sin(frameCount * 0.12);
                    ctx.strokeStyle = `rgba(255, 87, 34, ${pulse})`;
                    ctx.lineWidth = 2;
                    for (let r = 18; r <= 54; r += 18) {
                        ctx.beginPath();
                        ctx.arc(x + w / 2, y + h / 2, w / 2 + r, Math.PI, Math.PI * 2);
                        ctx.stroke();
                    }
                }

                const grad = ctx.createLinearGradient(x, y, x, y + h);
                grad.addColorStop(0, '#A0622D');
                grad.addColorStop(1, '#5D3A1A');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(x + 2, y + 5);
                ctx.lineTo(x + w - 2, y + 5);
                ctx.lineTo(x + w - 9, y + h);
                ctx.lineTo(x + 9, y + h);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                ctx.lineWidth = 1.5;
                for (let i = 10; i < w - 8; i += 10) {
                    ctx.beginPath();
                    ctx.moveTo(x + i, y + 6);
                    ctx.lineTo(x + i + 2, y + h);
                    ctx.stroke();
                }

                const rim = ctx.createLinearGradient(x, y, x, y + 9);
                rim.addColorStop(0, '#D99C5B');
                rim.addColorStop(1, '#A0622D');
                ctx.fillStyle = rim;
                roundRectPath(x - 3, y, w + 6, 9, 4);
                ctx.fill();

                ctx.restore();
            }

            // ---------- Spawning & difficulty ----------
            function spawnObject() {
                if (frameCount % spawnRate === 0) {
                    const count = (level >= 5 && Math.random() < 0.3) ? 2 : 1;
                    for (let i = 0; i < count; i++) fallingObjects.push(new FallingObject());
                }
            }

            function updateDifficulty() {
                const newLevel = Math.min(Math.floor(score / 30) + 1, 10);
                if (newLevel > level) {
                    level = newLevel;
                    levelElement.textContent = level;
                    floatingTexts.push(new FloatingText(W / 2, H / 2, 'LEVEL ' + level + '!', '#FFD700', 26));
                    sounds.levelUp();
                }
                objectSpeed = 3 + (level - 1) * 0.35;
                spawnRate = Math.max(24, 60 - (level - 1) * 4);
            }

            // ---------- Core updates ----------
            function updateObjects() {
                const timeScale = activePowerUp === 'slower' ? 0.5 : 1;

                for (let i = fallingObjects.length - 1; i >= 0; i--) {
                    const obj = fallingObjects[i];
                    obj.update(timeScale);

                    if (obj.isOffScreen()) {
                        fallingObjects.splice(i, 1);
                        // Missing a star breaks your combo
                        if (obj.type === 'star' && combo > 0) {
                            combo = 0;
                            comboTimer = 0;
                            updateComboDisplay();
                            sounds.miss();
                        }
                        continue;
                    }

                    if (obj.collidesWith()) {
                        const cx = obj.x + obj.width / 2;
                        const cy = obj.y + obj.height / 2;

                        if (obj.type === 'star') {
                            let points = obj.starType === 'silver' ? 2 : obj.starType === 'golden' ? 5 : 1;
                            if (activePowerUp === 'double') points *= 2;

                            combo++;
                            comboTimer = COMBO_TIMEOUT;
                            if (combo > bestCombo) bestCombo = combo;
                            points *= getMultiplier();

                            score += points;
                            scoreElement.textContent = score;

                            createParticles(cx, cy, obj.color, 15);
                            floatingTexts.push(new FloatingText(cx, cy - 10, '+' + points, obj.color));

                            if (combo % 5 === 0) {
                                floatingTexts.push(new FloatingText(W / 2, H * 0.35, 'COMBO x' + getMultiplier() + '!', '#FFD700', 22));
                            }

                            sounds.catch(combo);
                            updateComboDisplay();
                            updateDifficulty();

                        } else if (obj.type === 'bomb') {
                            if (activePowerUp === 'shield') {
                                setActivePowerUp(null);
                                createParticles(cx, cy, '#9C27B0', 20);
                                floatingTexts.push(new FloatingText(cx, cy - 10, 'Blocked!', '#CE93D8'));
                                playTone(300, 0.15, 'square', 0.1, 500);
                            } else {
                                lives--;
                                updateLivesDisplay();
                                combo = 0;
                                comboTimer = 0;
                                updateComboDisplay();
                                createParticles(cx, cy, '#FF4500', 25);
                                shakeAmount = 12;
                                flashAlpha = 0.35;
                                sounds.bomb();
                                vibrate([80, 40, 80]);
                                if (lives <= 0) {
                                    gameOver();
                                    return;
                                }
                            }

                        } else if (obj.type === 'powerup') {
                            createParticles(cx, cy, obj.color, 18);
                            const info = POWERUP_INFO[obj.powerUpType];
                            floatingTexts.push(new FloatingText(cx, cy - 10, info.name, info.color));

                            if (obj.powerUpType === 'life') {
                                if (lives < 5) {
                                    lives++;
                                    updateLivesDisplay();
                                    sounds.life();
                                } else {
                                    // Already full on lives - give bonus points instead
                                    score += 10;
                                    scoreElement.textContent = score;
                                    updateDifficulty();
                                    sounds.powerup();
                                }
                            } else {
                                setActivePowerUp(obj.powerUpType);
                                sounds.powerup();
                            }
                        }

                        fallingObjects.splice(i, 1);
                    }
                }
            }

            function setActivePowerUp(type) {
                if (activePowerUp === 'wider' && type !== 'wider') basketWidth = baseBasketWidth;
                activePowerUp = type;
                if (type) {
                    powerUpTimer = POWERUP_DURATION;
                    powerUpMaxTime = POWERUP_DURATION;
                    if (type === 'wider') {
                        basketWidth = 120;
                        if (basketX + basketWidth > W) basketX = W - basketWidth;
                    }
                } else {
                    powerUpTimer = 0;
                    powerUpMaxTime = 0;
                }
                updatePowerUpIndicator();
            }

            function updatePowerUps() {
                if (activePowerUp && powerUpTimer > 0) {
                    powerUpTimer--;
                    if (powerUpTimer <= 0) setActivePowerUp(null);
                }
            }

            function updatePowerUpIndicator() {
                if (activePowerUp) {
                    powerUpIndicator.classList.remove('hidden');
                    powerUpName.textContent = POWERUP_INFO[activePowerUp].name;
                    powerUpBar.style.background = POWERUP_INFO[activePowerUp].color;
                } else {
                    powerUpIndicator.classList.add('hidden');
                }
            }

            function updateComboTimer() {
                if (combo > 0) {
                    comboTimer--;
                    if (comboTimer <= 0) {
                        combo = 0;
                        updateComboDisplay();
                    }
                }
            }

            function updateComboDisplay() {
                if (combo >= 3) {
                    comboDisplay.classList.remove('hidden');
                    comboDisplay.textContent = `COMBO x${getMultiplier()} (${combo})`;
                    comboDisplay.style.transform = 'scale(1.25)';
                    setTimeout(() => { comboDisplay.style.transform = 'scale(1)'; }, 100);
                } else {
                    comboDisplay.classList.add('hidden');
                }
            }

            function updateLivesDisplay() {
                const total = Math.max(3, lives);
                let html = '';
                for (let i = 0; i < total; i++) {
                    html += `<span class="heart${i < lives ? '' : ' lost'}">♥</span>`;
                }
                livesElement.innerHTML = html;
            }

            function updateParticles() {
                for (let i = particles.length - 1; i >= 0; i--) {
                    particles[i].update();
                    if (particles[i].isDead()) particles.splice(i, 1);
                }
                for (let i = floatingTexts.length - 1; i >= 0; i--) {
                    floatingTexts[i].update();
                    if (floatingTexts[i].isDead()) floatingTexts.splice(i, 1);
                }
            }

            // ---------- Main loop ----------
            function gameLoop() {
                if (!gameRunning || gamePaused) return;

                ctx.clearRect(0, 0, W, H);

                ctx.save();
                if (shakeAmount > 0) {
                    ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount);
                    shakeAmount *= 0.88;
                    if (shakeAmount < 0.3) shakeAmount = 0;
                }

                drawBackground();
                updateBasket();
                drawBasket();
                spawnObject();
                updateObjects();
                if (!gameRunning) { ctx.restore(); return; } // game over triggered
                updatePowerUps();
                updateComboTimer();
                updateParticles();

                fallingObjects.forEach(obj => obj.draw());
                particles.forEach(p => p.draw());
                floatingTexts.forEach(t => t.draw());

                ctx.restore();

                // Damage flash
                if (flashAlpha > 0) {
                    ctx.fillStyle = `rgba(255, 40, 40, ${flashAlpha})`;
                    ctx.fillRect(0, 0, W, H);
                    flashAlpha -= 0.02;
                }

                if (activePowerUp && powerUpMaxTime > 0) {
                    powerUpBar.style.width = Math.max(0, (powerUpTimer / powerUpMaxTime) * 100) + '%';
                }

                frameCount++;
                requestAnimationFrame(gameLoop);
            }

            // ---------- Start / Game over ----------
            function startGame() {
                gameRunning = true;
                gamePaused = false;
                score = 0;
                lives = 3;
                level = 1;
                combo = 0;
                bestCombo = 0;
                comboTimer = 0;
                fallingObjects = [];
                particles = [];
                floatingTexts = [];
                objectSpeed = 3;
                spawnRate = 60;
                frameCount = 0;
                basketWidth = baseBasketWidth;
                basketX = W / 2 - basketWidth / 2;
                shakeAmount = 0;
                flashAlpha = 0;
                setActivePowerUp(null);

                scoreElement.textContent = score;
                levelElement.textContent = level;
                updateLivesDisplay();
                updateComboDisplay();
                updatePowerUpIndicator();

                startScreen.classList.add('hidden');
                gameOverScreen.classList.add('hidden');
                pausedScreen.classList.add('hidden');

                requestAnimationFrame(gameLoop);
            }

            function gameOver() {
                gameRunning = false;
                sounds.gameOver();
                vibrate(200);

                const isNewRecord = score > highScore;
                if (isNewRecord) {
                    highScore = score;
                    localStorage.setItem('catchTheStarsHighScore', highScore);
                    highScoreElement.textContent = highScore;
                }

                newRecordElement.classList.toggle('hidden', !isNewRecord);
                finalScoreElement.textContent = score;
                finalLevelElement.textContent = level;
                finalComboElement.textContent = bestCombo;
                finalHighScoreElement.textContent = highScore;
                gameOverScreen.classList.remove('hidden');
            }

            // ---------- Init ----------
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            updateLivesDisplay();
        });
