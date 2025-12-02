import { Component, ElementRef, OnInit, OnDestroy, ViewChild, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Vector {
    x: number;
    y: number;
}

interface Ship {
    pos: Vector;
    vel: Vector;
    angle: number;
    thrust: boolean;
    radius: number;
}

interface Asteroid {
    pos: Vector;
    vel: Vector;
    angle: number;
    rotationSpeed: number;
    radius: number;
    size: 'large' | 'medium' | 'small';
    points: Vector[];
}

interface Bullet {
    pos: Vector;
    vel: Vector;
    life: number;
}

interface Particle {
    pos: Vector;
    vel: Vector;
    life: number;
    maxLife: number;
}

@Component({
    selector: 'app-space-rocks-game',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './space-rocks-game.component.html',
    styleUrls: ['./space-rocks-game.component.css']
})
export class SpaceRocksGameComponent implements OnInit, OnDestroy {
    @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

    exitGame = output<void>();

    private ctx!: CanvasRenderingContext2D;
    private animationFrameId: number = 0;
    private keys: { [key: string]: boolean } = {};

    // Audio context for sound effects
    private audioContext!: AudioContext;

    // Game state
    private ship!: Ship;
    private asteroids: Asteroid[] = [];
    private bullets: Bullet[] = [];
    private particles: Particle[] = [];
    private gameOver = false;
    private paused = false;
    private lastShot = 0;

    // Game metrics
    protected score = signal(0);
    protected lives = signal(3);
    protected level = signal(1);
    protected gameOverState = signal(false);

    // Constants
    private readonly SHIP_SIZE = 15;
    private readonly SHIP_THRUST = 0.15;
    private readonly SHIP_TURN_SPEED = 0.08;
    private readonly FRICTION = 0.98;
    private readonly BULLET_SPEED = 7;
    private readonly BULLET_LIFE = 60;
    private readonly SHOT_DELAY = 250; // ms
    private readonly FPS = 60;

    ngOnInit(): void {
        this.initCanvas();
        this.initAudio();
        this.initGame();
        this.setupEventListeners();
        this.gameLoop();
    }

    ngOnDestroy(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('resize', this.handleResize);
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    private initCanvas(): void {
        const canvas = this.canvasRef.nativeElement;
        this.ctx = canvas.getContext('2d')!;
        this.resizeCanvas();
    }

    private resizeCanvas(): void {
        const canvas = this.canvasRef.nativeElement;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    private initAudio(): void {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    private initGame(): void {
        const canvas = this.canvasRef.nativeElement;

        // Initialize ship
        this.ship = {
            pos: { x: canvas.width / 2, y: canvas.height / 2 },
            vel: { x: 0, y: 0 },
            angle: -Math.PI / 2,
            thrust: false,
            radius: this.SHIP_SIZE
        };

        // Reset game state
        this.asteroids = [];
        this.bullets = [];
        this.particles = [];
        this.gameOver = false;
        this.score.set(0);
        this.lives.set(3);
        this.level.set(1);
        this.gameOverState.set(false);

        // Create initial asteroids
        this.createAsteroids(4);
    }

    private createAsteroids(count: number): void {
        const canvas = this.canvasRef.nativeElement;
        const minDistance = 150; // Minimum distance from ship

        for (let i = 0; i < count; i++) {
            let pos: Vector;
            let distance: number;

            // Ensure asteroid spawns away from ship
            do {
                pos = {
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height
                };
                distance = Math.hypot(pos.x - this.ship.pos.x, pos.y - this.ship.pos.y);
            } while (distance < minDistance);

            this.asteroids.push(this.createAsteroid(pos, 'large'));
        }
    }

    private createAsteroid(pos: Vector, size: 'large' | 'medium' | 'small'): Asteroid {
        const radiusMap = { large: 40, medium: 25, small: 15 };
        const speedMap = { large: 1, medium: 1.5, small: 2 };

        const angle = Math.random() * Math.PI * 2;
        const speed = speedMap[size] * (0.5 + Math.random() * 0.5);

        // Generate fixed asteroid shape points
        const numPoints = 8;
        const points: Vector[] = [];
        for (let i = 0; i < numPoints; i++) {
            const angle = (Math.PI * 2 * i) / numPoints;
            const variation = 0.7 + Math.random() * 0.3;
            const radius = radiusMap[size] * variation;
            points.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius
            });
        }

        return {
            pos: { ...pos },
            vel: {
                x: Math.cos(angle) * speed,
                y: Math.sin(angle) * speed
            },
            angle: 0,
            rotationSpeed: (Math.random() - 0.5) * 0.05,
            radius: radiusMap[size],
            size,
            points
        };
    }

    private setupEventListeners(): void {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        window.addEventListener('resize', this.handleResize);
    }

    private handleKeyDown = (e: KeyboardEvent): void => {
        this.keys[e.key.toLowerCase()] = true;

        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            this.shoot();
        }

        if (e.key.toLowerCase() === 'r' && this.gameOver) {
            this.initGame();
        }

        if (e.key.toLowerCase() === 'p') {
            this.paused = !this.paused;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            this.exitGame.emit();
        }
    };

    goBackToHome(): void {
        this.exitGame.emit();
    }

    private handleKeyUp = (e: KeyboardEvent): void => {
        this.keys[e.key.toLowerCase()] = false;
    };

    private handleResize = (): void => {
        this.resizeCanvas();
    };

    private shoot(): void {
        if (this.gameOver || this.paused) return;

        const now = Date.now();
        if (now - this.lastShot < this.SHOT_DELAY) return;

        this.lastShot = now;

        const bullet: Bullet = {
            pos: {
                x: this.ship.pos.x + Math.cos(this.ship.angle) * this.ship.radius,
                y: this.ship.pos.y + Math.sin(this.ship.angle) * this.ship.radius
            },
            vel: {
                x: Math.cos(this.ship.angle) * this.BULLET_SPEED + this.ship.vel.x,
                y: Math.sin(this.ship.angle) * this.BULLET_SPEED + this.ship.vel.y
            },
            life: this.BULLET_LIFE
        };

        this.bullets.push(bullet);
        this.playShootSound();
    }

    private gameLoop = (): void => {
        if (!this.paused && !this.gameOver) {
            this.update();
        }
        this.draw();
        this.animationFrameId = requestAnimationFrame(this.gameLoop);
    };

    private update(): void {
        this.updateShip();
        this.updateBullets();
        this.updateAsteroids();
        this.updateParticles();
        this.checkCollisions();

        // Check level completion
        if (this.asteroids.length === 0 && !this.gameOver) {
            this.level.update(l => l + 1);
            this.createAsteroids(4 + this.level());
        }
    }

    private updateShip(): void {
        const canvas = this.canvasRef.nativeElement;

        // Rotation
        if (this.keys['arrowleft'] || this.keys['a']) {
            this.ship.angle -= this.SHIP_TURN_SPEED;
        }
        if (this.keys['arrowright'] || this.keys['d']) {
            this.ship.angle += this.SHIP_TURN_SPEED;
        }

        // Thrust
        this.ship.thrust = this.keys['arrowup'] || this.keys['w'];
        if (this.ship.thrust) {
            this.ship.vel.x += Math.cos(this.ship.angle) * this.SHIP_THRUST;
            this.ship.vel.y += Math.sin(this.ship.angle) * this.SHIP_THRUST;
            this.playThrustSound();
        }

        // Apply friction
        this.ship.vel.x *= this.FRICTION;
        this.ship.vel.y *= this.FRICTION;

        // Update position
        this.ship.pos.x += this.ship.vel.x;
        this.ship.pos.y += this.ship.vel.y;

        // Wrap around screen
        this.wrapPosition(this.ship.pos, canvas.width, canvas.height);
    }

    private updateBullets(): void {
        const canvas = this.canvasRef.nativeElement;

        this.bullets = this.bullets.filter(bullet => {
            bullet.pos.x += bullet.vel.x;
            bullet.pos.y += bullet.vel.y;
            bullet.life--;

            this.wrapPosition(bullet.pos, canvas.width, canvas.height);

            return bullet.life > 0;
        });
    }

    private updateAsteroids(): void {
        const canvas = this.canvasRef.nativeElement;

        this.asteroids.forEach(asteroid => {
            asteroid.pos.x += asteroid.vel.x;
            asteroid.pos.y += asteroid.vel.y;
            asteroid.angle += asteroid.rotationSpeed;

            this.wrapPosition(asteroid.pos, canvas.width, canvas.height);
        });
    }

    private updateParticles(): void {
        this.particles = this.particles.filter(particle => {
            particle.pos.x += particle.vel.x;
            particle.pos.y += particle.vel.y;
            particle.vel.x *= 0.98;
            particle.vel.y *= 0.98;
            particle.life--;

            return particle.life > 0;
        });
    }

    private wrapPosition(pos: Vector, width: number, height: number): void {
        if (pos.x < 0) pos.x = width;
        if (pos.x > width) pos.x = 0;
        if (pos.y < 0) pos.y = height;
        if (pos.y > height) pos.y = 0;
    }

    private checkCollisions(): void {
        // Check bullet-asteroid collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                const bullet = this.bullets[i];
                const asteroid = this.asteroids[j];

                if (this.checkCircleCollision(bullet.pos, 2, asteroid.pos, asteroid.radius)) {
                    this.destroyAsteroid(j);
                    this.bullets.splice(i, 1);
                    break;
                }
            }
        }

        // Check ship-asteroid collisions
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const asteroid = this.asteroids[i];

            if (this.checkCircleCollision(this.ship.pos, this.ship.radius, asteroid.pos, asteroid.radius)) {
                this.destroyShip();
                this.destroyAsteroid(i);
                break;
            }
        }
    }

    private checkCircleCollision(pos1: Vector, r1: number, pos2: Vector, r2: number): boolean {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < r1 + r2;
    }

    private destroyAsteroid(index: number): void {
        const asteroid = this.asteroids[index];

        // Update score
        const scoreMap = { large: 20, medium: 50, small: 100 };
        this.score.update(s => s + scoreMap[asteroid.size]);

        // Create particles
        this.createExplosion(asteroid.pos, 8);

        // Split asteroid if not small
        if (asteroid.size === 'large') {
            for (let i = 0; i < 2; i++) {
                this.asteroids.push(this.createAsteroid(asteroid.pos, 'medium'));
            }
        } else if (asteroid.size === 'medium') {
            for (let i = 0; i < 2; i++) {
                this.asteroids.push(this.createAsteroid(asteroid.pos, 'small'));
            }
        }

        this.asteroids.splice(index, 1);
        this.playExplosionSound();
    }

    private destroyShip(): void {
        this.createExplosion(this.ship.pos, 20);
        this.playExplosionSound();

        this.lives.update(l => l - 1);

        if (this.lives() <= 0) {
            this.gameOver = true;
            this.gameOverState.set(true);
        } else {
            // Reset ship position
            const canvas = this.canvasRef.nativeElement;
            this.ship.pos.x = canvas.width / 2;
            this.ship.pos.y = canvas.height / 2;
            this.ship.vel.x = 0;
            this.ship.vel.y = 0;
            this.ship.angle = -Math.PI / 2;
        }
    }

    private createExplosion(pos: Vector, count: number): void {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const speed = 2 + Math.random() * 2;

            this.particles.push({
                pos: { ...pos },
                vel: {
                    x: Math.cos(angle) * speed,
                    y: Math.sin(angle) * speed
                },
                life: 30,
                maxLife: 30
            });
        }
    }

    private draw(): void {
        const canvas = this.canvasRef.nativeElement;
        const ctx = this.ctx;

        // Clear canvas with black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw particles
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillRect(particle.pos.x - 1, particle.pos.y - 1, 2, 2);
        });

        // Draw asteroids
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        this.asteroids.forEach(asteroid => this.drawAsteroid(asteroid));

        // Draw bullets
        ctx.fillStyle = '#FFFFFF';
        this.bullets.forEach(bullet => {
            ctx.fillRect(bullet.pos.x - 1, bullet.pos.y - 1, 2, 2);
        });

        // Draw ship
        if (!this.gameOver) {
            this.drawShip();
        }

        // Draw UI
        this.drawUI();
    }

    private drawShip(): void {
        const ctx = this.ctx;
        const ship = this.ship;

        ctx.save();
        ctx.translate(ship.pos.x, ship.pos.y);
        ctx.rotate(ship.angle);

        // Draw thrust flame first (so it appears behind the ship)
        if (ship.thrust) {
            ctx.beginPath();
            ctx.moveTo(-this.SHIP_SIZE / 2, 0);
            ctx.lineTo(-this.SHIP_SIZE * 1.5, -this.SHIP_SIZE / 3);
            ctx.lineTo(-this.SHIP_SIZE * 1.8, 0);
            ctx.lineTo(-this.SHIP_SIZE * 1.5, this.SHIP_SIZE / 3);
            ctx.closePath();

            // Yellow flame with gradient effect
            const gradient = ctx.createLinearGradient(-this.SHIP_SIZE / 2, 0, -this.SHIP_SIZE * 1.8, 0);
            gradient.addColorStop(0, '#FFA500'); // Orange at base
            gradient.addColorStop(1, '#FFFF00'); // Yellow at tip
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        // Draw solid green ship body
        ctx.beginPath();
        ctx.moveTo(this.SHIP_SIZE, 0);
        ctx.lineTo(-this.SHIP_SIZE, -this.SHIP_SIZE / 2);
        ctx.lineTo(-this.SHIP_SIZE, this.SHIP_SIZE / 2);
        ctx.closePath();

        // Fill with green
        ctx.fillStyle = '#00FF00';
        ctx.fill();

        // Optional: Add darker green outline
        ctx.strokeStyle = '#00AA00';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    private drawAsteroid(asteroid: Asteroid): void {
        const ctx = this.ctx;

        ctx.save();
        ctx.translate(asteroid.pos.x, asteroid.pos.y);
        ctx.rotate(asteroid.angle);

        // Draw solid brown asteroid
        ctx.beginPath();
        for (let i = 0; i < asteroid.points.length; i++) {
            const point = asteroid.points[i];
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        }
        ctx.closePath();

        // Fill with brown color
        ctx.fillStyle = '#8B4513';
        ctx.fill();

        // Optional: Add a darker brown outline
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    private drawUI(): void {
        const ctx = this.ctx;
        const canvas = this.canvasRef.nativeElement;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px "Courier New", monospace';

        // Score
        ctx.fillText(`SCORE: ${this.score()}`, 20, 30);

        // Lives
        ctx.fillText(`LIVES: ${this.lives()}`, 20, 60);

        // Level
        ctx.fillText(`LEVEL: ${this.level()}`, 20, 90);

        // Game Over
        if (this.gameOver) {
            ctx.font = '48px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
            ctx.font = '24px "Courier New", monospace';
            ctx.fillText('Press R to Restart', canvas.width / 2, canvas.height / 2 + 50);
            ctx.textAlign = 'left';
        }

        // Paused
        if (this.paused) {
            ctx.font = '48px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
            ctx.font = '24px "Courier New", monospace';
            ctx.fillText('Press P to Resume', canvas.width / 2, canvas.height / 2 + 50);
            ctx.textAlign = 'left';
        }
    }

    // Sound effects using Web Audio API
    private playShootSound(): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    private playExplosionSound(): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }

    private thrustSoundPlaying = false;
    private thrustOscillator: OscillatorNode | null = null;
    private thrustGain: GainNode | null = null;

    private playThrustSound(): void {
        if (!this.audioContext) return;

        if (!this.thrustSoundPlaying) {
            this.thrustOscillator = this.audioContext.createOscillator();
            this.thrustGain = this.audioContext.createGain();

            this.thrustOscillator.connect(this.thrustGain);
            this.thrustGain.connect(this.audioContext.destination);

            this.thrustOscillator.type = 'sawtooth';
            this.thrustOscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
            this.thrustGain.gain.setValueAtTime(0.1, this.audioContext.currentTime);

            this.thrustOscillator.start(this.audioContext.currentTime);
            this.thrustSoundPlaying = true;

            // Stop thrust sound after a short delay
            setTimeout(() => {
                if (this.thrustOscillator && this.thrustGain) {
                    this.thrustGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                    this.thrustOscillator.stop(this.audioContext.currentTime + 0.1);
                    this.thrustSoundPlaying = false;
                    this.thrustOscillator = null;
                    this.thrustGain = null;
                }
            }, 100);
        }
    }
}
