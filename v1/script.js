
        document.addEventListener('DOMContentLoaded', () => {
            const canvas = document.getElementById('gameCanvas');
            const ctx = canvas.getContext('2d');
            const scoreElement = document.getElementById('score');
            const livesElement = document.getElementById('lives');
            const highScoreElement = document.getElementById('highScore');
            const startScreen = document.getElementById('startScreen');
            const gameOverScreen = document.getElementById('gameOverScreen');
            const pausedScreen = document.getElementById('pausedScreen');
            const finalScoreElement = document.getElementById('finalScore');
            const finalHighScoreElement = document.getElementById('finalHighScore');
            const powerUpIndicator = document.getElementById('powerUpIndicator');
            const startBtn = document.getElementById('startBtn');
            const restartBtn = document.getElementById('restartBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            const resumeBtn = document.getElementById('resumeBtn');
            const quitBtn = document.getElementById('quitBtn');
            
            // Load high score from localStorage
            let highScore = localStorage.getItem('catchTheStarsHighScore') || 0;
            highScoreElement.textContent = highScore;
            
            // Set canvas size
            function resizeCanvas() {
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
            }
            
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas);
            
            // Game variables
            let gameRunning = false;
            let gamePaused = false;
            let score = 0;
            let lives = 3;
            let basketWidth = 80;
            let basketHeight = 20;
            let basketX = canvas.width / 2 - basketWidth / 2;
            let basketY = canvas.height - 40;
            let basketSpeed = 8;
            let touchX = null;
            
            // Power-ups
            let activePowerUp = null;
            let powerUpTimer = 0;
            
            // Falling objects
            let fallingObjects = [];
            let particles = [];
            let objectSpeed = 3;
            let spawnRate = 60; // frames between spawns
            let frameCount = 0;
            
            // Simplified touch controls - only on canvas
            canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
            canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
            canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
            
            // Mouse controls for testing on desktop
            canvas.addEventListener('mousedown', handleMouseDown);
            canvas.addEventListener('mousemove', handleMouseMove);
            canvas.addEventListener('mouseup', handleMouseUp);
            
            function handleTouchStart(e) {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                touchX = touch.clientX - rect.left;
            }
            
            function handleTouchMove(e) {
                e.preventDefault();
                if (touchX !== null) {
                    const touch = e.touches[0];
                    const rect = canvas.getBoundingClientRect();
                    touchX = touch.clientX - rect.left;
                }
            }
            
            function handleTouchEnd(e) {
                e.preventDefault();
                touchX = null;
            }
            
            function handleMouseDown(e) {
                const rect = canvas.getBoundingClientRect();
                touchX = e.clientX - rect.left;
            }
            
            function handleMouseMove(e) {
                if (touchX !== null) {
                    const rect = canvas.getBoundingClientRect();
                    touchX = e.clientX - rect.left;
                }
            }
            
            function handleMouseUp(e) {
                touchX = null;
            }
            
            // Simple button event listeners
            startBtn.addEventListener('click', startGame);
            restartBtn.addEventListener('click', startGame);
            pauseBtn.addEventListener('click', togglePause);
            resumeBtn.addEventListener('click', togglePause);
            quitBtn.addEventListener('click', quitGame);
            
            function togglePause() {
                if (!gameRunning) return;
                
                gamePaused = !gamePaused;
                
                if (gamePaused) {
                    pausedScreen.classList.remove('hidden');
                } else {
                    pausedScreen.classList.add('hidden');
                    gameLoop();
                }
            }
            
            function quitGame() {
                gamePaused = false;
                gameRunning = false;
                pausedScreen.classList.add('hidden');
                startScreen.classList.remove('hidden');
            }
            
            // Game objects
            class FallingObject {
                constructor() {
                    this.width = 30;
                    this.height = 30;
                    this.x = Math.random() * (canvas.width - this.width);
                    this.y = -this.height;
                    
                    // Determine object type
                    const rand = Math.random();
                    if (rand < 0.6) {
                        this.type = 'star'; // 60% chance for star
                    } else if (rand < 0.85) {
                        this.type = 'bomb'; // 25% chance for bomb
                    } else {
                        this.type = 'powerup'; // 15% chance for power-up
                    }
                    
                    // Star types with different point values
                    if (this.type === 'star') {
                        const starType = Math.random();
                        if (starType < 0.7) {
                            this.starType = 'normal'; // 70% normal stars (1 point)
                            this.color = '#FFD700';
                        } else if (starType < 0.9) {
                            this.starType = 'silver'; // 20% silver stars (2 points)
                            this.color = '#C0C0C0';
                        } else {
                            this.starType = 'golden'; // 10% golden stars (5 points)
                            this.color = '#FFA500';
                        }
                    }
                    
                    // Power-up types
                    if (this.type === 'powerup') {
                        const powerUpType = Math.random();
                        if (powerUpType < 0.4) {
                            this.powerUpType = 'wider'; // 40% wider basket
                            this.color = '#4CAF50';
                        } else if (powerUpType < 0.7) {
                            this.powerUpType = 'slower'; // 30% slower objects
                            this.color = '#2196F3';
                        } else {
                            this.powerUpType = 'shield'; // 30% shield (protect from one bomb)
                            this.color = '#9C27B0';
                        }
                    }
                    
                    this.speed = objectSpeed + Math.random() * 2;
                    this.rotation = 0;
                    this.rotationSpeed = (Math.random() - 0.5) * 0.1;
                }
                
                update() {
                    this.y += this.speed;
                    this.rotation += this.rotationSpeed;
                }
                
                draw() {
                    if (this.type === 'star') {
                        // Draw star
                        ctx.fillStyle = this.color;
                        ctx.beginPath();
                        const spikes = 5;
                        const outerRadius = this.width / 2;
                        const innerRadius = outerRadius / 2;
                        let rot = Math.PI / 2 * 3;
                        const step = Math.PI / spikes;
                        
                        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
                        ctx.moveTo(0, -outerRadius);
                        
                        for (let i = 0; i < spikes; i++) {
                            ctx.lineTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
                            rot += step;
                            ctx.lineTo(Math.cos(rot) * innerRadius, Math.sin(rot) * innerRadius);
                            rot += step;
                        }
                        
                        ctx.lineTo(0, -outerRadius);
                        ctx.closePath();
                        ctx.fill();
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        
                        // Add glow effect for golden stars
                        if (this.starType === 'golden') {
                            ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
                            ctx.beginPath();
                            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
                            ctx.arc(0, 0, this.width / 2 + 5, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.setTransform(1, 0, 0, 1, 0, 0);
                        }
                    } else if (this.type === 'bomb') {
                        // Draw bomb
                        ctx.fillStyle = '#333';
                        ctx.beginPath();
                        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // Draw fuse
                        ctx.strokeStyle = '#8B4513';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(this.x + this.width / 2, this.y);
                        ctx.lineTo(this.x + this.width / 2 - 5, this.y - 10);
                        ctx.stroke();
                        
                        // Draw spark
                        ctx.fillStyle = '#FF4500';
                        ctx.beginPath();
                        ctx.arc(this.x + this.width / 2 - 5, this.y - 10, 3, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (this.type === 'powerup') {
                        // Draw power-up
                        ctx.fillStyle = this.color;
                        ctx.beginPath();
                        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // Draw icon based on power-up type
                        ctx.fillStyle = 'white';
                        ctx.font = '16px Arial';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        
                        if (this.powerUpType === 'wider') {
                            ctx.fillText('↔', this.x + this.width / 2, this.y + this.height / 2);
                        } else if (this.powerUpType === 'slower') {
                            ctx.fillText('▼', this.x + this.width / 2, this.y + this.height / 2);
                        } else if (this.powerUpType === 'shield') {
                            ctx.fillText('🛡', this.x + this.width / 2, this.y + this.height / 2);
                        }
                    }
                }
                
                isOffScreen() {
                    return this.y > canvas.height;
                }
                
                collidesWith(basket) {
                    return this.x < basketX + basketWidth &&
                           this.x + this.width > basketX &&
                           this.y < basketY + basketHeight &&
                           this.y + this.height > basketY;
                }
            }
            
            // Particle class for effects
            class Particle {
                constructor(x, y, color) {
                    this.x = x;
                    this.y = y;
                    this.color = color;
                    this.size = Math.random() * 5 + 2;
                    this.speedX = (Math.random() - 0.5) * 5;
                    this.speedY = (Math.random() - 0.5) * 5;
                    this.life = 1.0; // Full life
                }
                
                update() {
                    this.x += this.speedX;
                    this.y += this.speedY;
                    this.life -= 0.02;
                    this.size *= 0.98;
                }
                
                draw() {
                    ctx.globalAlpha = this.life;
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                }
                
                isDead() {
                    return this.life <= 0 || this.size <= 0.5;
                }
            }
            
            // Create particles at position
            function createParticles(x, y, color, count = 10) {
                for (let i = 0; i < count; i++) {
                    particles.push(new Particle(x, y, color));
                }
            }
            
            // Game functions
            function updateBasket() {
                if (touchX !== null) {
                    // Use smooth movement like in the working example
                    const targetX = touchX - basketWidth / 2;
                    const diff = targetX - basketX;
                    basketX += diff * 0.2; // Smooth movement
                    
                    // Keep basket within bounds
                    if (basketX < 0) basketX = 0;
                    if (basketX + basketWidth > canvas.width) basketX = canvas.width - basketWidth;
                }
            }
            
            function drawBasket() {
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(basketX, basketY, basketWidth, basketHeight);
                
                // Basket pattern
                ctx.strokeStyle = '#654321';
                ctx.lineWidth = 2;
                for (let i = 0; i < basketWidth; i += 10) {
                    ctx.beginPath();
                    ctx.moveTo(basketX + i, basketY);
                    ctx.lineTo(basketX + i, basketY + basketHeight);
                    ctx.stroke();
                }
                
                // Draw shield if active
                if (activePowerUp === 'shield') {
                    ctx.strokeStyle = 'rgba(156, 39, 176, 0.7)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(basketX + basketWidth / 2, basketY + basketHeight / 2, basketWidth / 2 + 10, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            
            function spawnObject() {
                if (frameCount % spawnRate === 0) {
                    fallingObjects.push(new FallingObject());
                    
                    // Gradually increase difficulty
                    if (score > 0 && score % 10 === 0 && spawnRate > 20) {
                        spawnRate -= 2;
                    }
                    
                    if (score > 0 && score % 15 === 0) {
                        objectSpeed += 0.5;
                    }
                }
            }
            
            function updateObjects() {
                for (let i = fallingObjects.length - 1; i >= 0; i--) {
                    const obj = fallingObjects[i];
                    obj.update();
                    
                    if (obj.isOffScreen()) {
                        fallingObjects.splice(i, 1);
                        continue;
                    }
                    
                    if (obj.collidesWith()) {
                        if (obj.type === 'star') {
                            // Add points based on star type
                            let points = 1;
                            if (obj.starType === 'silver') points = 2;
                            if (obj.starType === 'golden') points = 5;
                            
                            score += points;
                            scoreElement.textContent = score;
                            
                            // Create particles
                            createParticles(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.color, 15);
                        } else if (obj.type === 'bomb') {
                            // Check if shield is active
                            if (activePowerUp === 'shield') {
                                activePowerUp = null;
                                powerUpTimer = 0;
                                updatePowerUpIndicator();
                                createParticles(obj.x + obj.width / 2, obj.y + obj.height / 2, '#9C27B0', 20);
                            } else {
                                lives -= 1;
                                livesElement.textContent = lives;
                                
                                if (lives <= 0) {
                                    gameOver();
                                }
                                
                                // Create explosion particles
                                createParticles(obj.x + obj.width / 2, obj.y + obj.height / 2, '#FF4500', 20);
                            }
                        } else if (obj.type === 'powerup') {
                            // Activate power-up
                            activePowerUp = obj.powerUpType;
                            powerUpTimer = 300; // 5 seconds at 60fps
                            updatePowerUpIndicator();
                            
                            // Create particles
                            createParticles(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.color, 20);
                            
                            // Apply immediate effects
                            if (obj.powerUpType === 'wider') {
                                basketWidth = 120;
                            } else if (obj.powerUpType === 'slower') {
                                // Slow down all existing objects
                                fallingObjects.forEach(fallingObj => {
                                    fallingObj.speed *= 0.7;
                                });
                            }
                        }
                        
                        fallingObjects.splice(i, 1);
                    }
                }
            }
            
            function updatePowerUpIndicator() {
                if (activePowerUp) {
                    powerUpIndicator.classList.remove('hidden');
                    
                    let text = '';
                    if (activePowerUp === 'wider') text = 'Wider Basket';
                    else if (activePowerUp === 'slower') text = 'Slow Motion';
                    else if (activePowerUp === 'shield') text = 'Shield Active';
                    
                    powerUpIndicator.textContent = text;
                } else {
                    powerUpIndicator.classList.add('hidden');
                }
            }
            
            function updatePowerUps() {
                if (activePowerUp && powerUpTimer > 0) {
                    powerUpTimer--;
                    
                    if (powerUpTimer <= 0) {
                        // Reset power-up effects
                        if (activePowerUp === 'wider') {
                            basketWidth = 80;
                        }
                        
                        activePowerUp = null;
                        updatePowerUpIndicator();
                    }
                }
            }
            
            function updateParticles() {
                for (let i = particles.length - 1; i >= 0; i--) {
                    const particle = particles[i];
                    particle.update();
                    
                    if (particle.isDead()) {
                        particles.splice(i, 1);
                    }
                }
            }
            
            function drawBackground() {
                // Draw animated stars in background
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                for (let i = 0; i < 50; i++) {
                    const x = (i * 73 + frameCount * 0.1) % canvas.width;
                    const y = (i * 37) % canvas.height;
                    const size = ((i % 3) + 1) * (0.8 + 0.4 * Math.sin(frameCount * 0.05 + i));
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            function gameLoop() {
                if (!gameRunning || gamePaused) return;
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                drawBackground();
                
                updateBasket();
                drawBasket();
                
                spawnObject();
                updateObjects();
                updatePowerUps();
                updateParticles();
                
                fallingObjects.forEach(obj => obj.draw());
                particles.forEach(particle => particle.draw());
                
                frameCount++;
                requestAnimationFrame(gameLoop);
            }
            
            function startGame() {
                gameRunning = true;
                gamePaused = false;
                score = 0;
                lives = 3;
                fallingObjects = [];
                particles = [];
                objectSpeed = 3;
                spawnRate = 60;
                frameCount = 0;
                basketWidth = 80;
                basketX = canvas.width / 2 - basketWidth / 2;
                activePowerUp = null;
                powerUpTimer = 0;
                
                scoreElement.textContent = score;
                livesElement.textContent = lives;
                updatePowerUpIndicator();
                
                startScreen.classList.add('hidden');
                gameOverScreen.classList.add('hidden');
                pausedScreen.classList.add('hidden');
                
                gameLoop();
            }
            
            function gameOver() {
                gameRunning = false;
                
                // Update high score
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('catchTheStarsHighScore', highScore);
                    highScoreElement.textContent = highScore;
                }
                
                finalScoreElement.textContent = score;
                finalHighScoreElement.textContent = highScore;
                gameOverScreen.classList.remove('hidden');
            }
        });
