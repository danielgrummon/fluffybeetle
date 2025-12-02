import { Component, OnInit, OnDestroy, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface GameObject {
    x: number;
    y: number;
    width: number;
    height: number;
    active: boolean;
}

interface Invader extends GameObject {
    type: number;
    animFrame: number;
}

interface Bullet extends GameObject {
    speed: number;
}

interface Barrier extends GameObject {
    health: number;
}

@Component({
    selector: 'app-alien-invaders',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './alien-invaders.component.html',
    styleUrls: ['./alien-invaders.component.css']
})
export class AlienInvadersComponent implements OnInit, OnDestroy {
    protected canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private animationFrameId: number = 0;

    // Game state
    protected score = signal(0);
    protected lives = signal(3);
    protected level = signal(1);
    protected gameOver = signal(false);
    protected paused = signal(false);

    // Player
    private player: GameObject & { speed: number } = {
        x: 0,
        y: 0,
        width: 26,
        height: 16,
        active: true,
        speed: 3
    };    // Invaders
    private invaders: Invader[] = [];
    private invaderDirection = 1;
    private invaderSpeed = 12;
    private baseInvaderSpeed = 12; // Base speed to reset to at start of level
    private invaderDropAmount = 16;
    private animationCounter = 0;
    private animationSpeed = 1000; // 1 second per transition
    private baseAnimationSpeed = 1000; // Base animation speed to reset to at start of level
    private invaderMoveSound = 0; // Track which sound to play (0-3 for 4 different tones)

    // Mother ship
    private motherShip: GameObject & { direction: number; points: number } = {
        x: -50,
        y: 30,
        width: 32,
        height: 14,
        active: false,
        direction: 1,
        points: 0
    };

    // Bullets
    private playerBullets: Bullet[] = [];
    private invaderBullets: Bullet[] = [];

    // Barriers
    private barriers: Barrier[] = [];

    // Keys
    private keys: { [key: string]: boolean } = {};

    // Timing
    private lastTime = 0;
    private invaderShootTimer = 0;
    private motherShipTimer = 0;

    // Audio context for sound effects
    private audioContext: AudioContext | null = null;

    // Scale factor for making everything bigger
    private scale = 1;

    // Barrier boundaries for invader movement limits
    private barrierLeftBoundary = 0;
    private barrierRightBoundary = 800;

    ngOnInit(): void {
        setTimeout(() => {
            this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
            if (this.canvas) {
                this.resizeCanvas();
                this.ctx = this.canvas.getContext('2d');
                this.initAudio();
                this.initGame();
                this.gameLoop(0);
            }
        });
    }

    @HostListener('window:resize')
    onResize(): void {
        if (this.canvas) {
            this.resizeCanvas();
        }
    }

    private resizeCanvas(): void {
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Set canvas to fill the container
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;

        // Calculate scale factor (base size was 800x600)
        this.scale = Math.min(containerWidth / 800, containerHeight / 600);
    }

    ngOnDestroy(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent): void {
        this.keys[event.key] = true;

        if (event.key === ' ' && !this.gameOver() && !this.paused()) {
            event.preventDefault();
            this.shootPlayerBullet();
        }

        if (event.key === 'p' || event.key === 'P') {
            this.paused.set(!this.paused());
        }

        if (event.key === 'r' || event.key === 'R') {
            if (this.gameOver()) {
                this.initGame();
                this.gameOver.set(false);
            }
        }
    }

    @HostListener('window:keyup', ['$event'])
    handleKeyUp(event: KeyboardEvent): void {
        this.keys[event.key] = false;
    }

    private initAudio(): void {
        try {
            this.audioContext = new AudioContext();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    private playSound(frequency: number, duration: number, type: OscillatorType = 'square'): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    private playShootSound(): void {
        this.playSound(440, 0.1, 'square');
    }

    private playExplosionSound(): void {
        this.playSound(150, 0.2, 'sawtooth');
    }

    private playInvaderKilledSound(): void {
        this.playSound(100, 0.15, 'square');
    }

    private playInvaderMoveSound(): void {
        // Alternate between two deep, powerful bass tones
        const frequencies = [55, 45]; // 55 Hz (A1) and 45 Hz (deeper) for powerful thump-thump effect
        this.playSound(frequencies[this.invaderMoveSound % 2], 0.2, 'square');
        this.invaderMoveSound = (this.invaderMoveSound + 1) % 2;
    }

    private playMotherShipSound(): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 100;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);

        oscillator.start();

        // Stop after a short duration
        setTimeout(() => {
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.1);
            oscillator.stop(this.audioContext!.currentTime + 0.1);
        }, 200);
    }

    private initGame(): void {
        if (!this.canvas) return;

        // Update player size with scale - make it much bigger to match invaders
        this.player.width = 52 * this.scale;
        this.player.height = 32 * this.scale;
        this.player.speed = 3 * this.scale;

        // Reset player position
        this.player.x = this.canvas.width / 2 - this.player.width / 2;
        this.player.y = this.canvas.height - 60 * this.scale;

        // Update mother ship size
        this.motherShip.width = 48 * this.scale;
        this.motherShip.height = 24 * this.scale;

        // Reset game state
        this.score.set(0);
        this.lives.set(3);
        this.level.set(1);

        // Reset invader speed to base values
        this.invaderSpeed = this.baseInvaderSpeed;
        this.animationSpeed = this.baseAnimationSpeed;

        // Create invaders
        this.createInvaders();

        // Create barriers
        this.createBarriers();

        // Clear bullets
        this.playerBullets = [];
        this.invaderBullets = [];

        // Reset mother ship
        this.motherShip.active = false;
    }

    private createInvaders(): void {
        this.invaders = [];
        const startX = 180 * this.scale;
        const startY = 80 * this.scale;
        const spacingX = 50 * this.scale;
        const spacingY = 40 * this.scale;

        // 5 rows, 11 columns
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 11; col++) {
                let type = 0;
                if (row === 0) type = 2; // Top row - squid
                else if (row <= 2) type = 1; // Middle rows - crab
                else type = 0; // Bottom rows - octopus

                this.invaders.push({
                    x: startX + col * spacingX,
                    y: startY + row * spacingY,
                    width: 36 * this.scale,
                    height: 24 * this.scale,
                    active: true,
                    type: type,
                    animFrame: 0
                });
            }
        }
    }

    private createBarriers(): void {
        if (!this.canvas) return;

        this.barriers = [];
        const barrierY = this.canvas.height - 120 * this.scale;
        const barrierWidth = 60 * this.scale;
        const barrierHeight = 40 * this.scale;
        const spacing = (this.canvas.width - (barrierWidth * 4)) / 5;

        // Set movement boundaries with margin from edges
        // Left margin to clear the sidebar/button (sidebar is ~150px wide + padding)
        // Right margin to match the left margin distance
        this.barrierLeftBoundary = 160 * this.scale;
        this.barrierRightBoundary = this.canvas.width - (160 * this.scale);

        for (let i = 0; i < 4; i++) {
            const x = spacing + i * (barrierWidth + spacing);

            // Create multiple segments for each barrier for partial destruction
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 6; col++) {
                    this.barriers.push({
                        x: x + col * 10 * this.scale,
                        y: barrierY + row * 10 * this.scale,
                        width: 10 * this.scale,
                        height: 10 * this.scale,
                        active: true,
                        health: 3
                    });
                }
            }
        }
    }

    private gameLoop(timestamp: number): void {
        if (!this.ctx || !this.canvas) return;

        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (!this.paused() && !this.gameOver()) {
            this.update(deltaTime);
        }

        this.render();

        this.animationFrameId = requestAnimationFrame((ts) => this.gameLoop(ts));
    }

    private update(deltaTime: number): void {
        // Move player
        if (this.keys['ArrowLeft'] || this.keys['a']) {
            this.player.x = Math.max(0, this.player.x - this.player.speed);
        }
        if (this.keys['ArrowRight'] || this.keys['d']) {
            this.player.x = Math.min(this.canvas!.width - this.player.width, this.player.x + this.player.speed);
        }

        // Update invaders
        this.updateInvaders(deltaTime);

        // Update mother ship
        this.updateMotherShip(deltaTime);

        // Update bullets
        this.updateBullets();

        // Check collisions
        this.checkCollisions();

        // Invader shooting
        this.invaderShootTimer += deltaTime;
        if (this.invaderShootTimer > 1000) {
            this.invaderShoot();
            this.invaderShootTimer = 0;
        }

        // Check win condition
        if (this.invaders.every(inv => !inv.active)) {
            this.nextLevel();
        }
    }

    private updateInvaders(deltaTime: number): void {
        this.animationCounter += deltaTime;

        if (this.animationCounter > this.animationSpeed) {
            this.animationCounter = 0;

            // Check if invaders need to change direction
            let shouldDrop = false;

            for (const invader of this.invaders) {
                if (!invader.active) continue;

                const nextX = invader.x + this.invaderDirection * this.invaderSpeed * this.scale;

                // Use barrier boundaries instead of canvas boundaries
                if (nextX <= this.barrierLeftBoundary || nextX + invader.width >= this.barrierRightBoundary) {
                    shouldDrop = true;
                    break;
                }
            }

            if (shouldDrop) {
                this.invaderDirection *= -1;
                for (const invader of this.invaders) {
                    if (invader.active) {
                        invader.y += this.invaderDropAmount * this.scale;

                        // Check if invaders reached the bottom
                        if (invader.y + invader.height >= this.player.y) {
                            this.gameOver.set(true);
                        }
                    }
                }
            }

            // Move invaders and animate
            for (const invader of this.invaders) {
                if (invader.active) {
                    invader.x += this.invaderDirection * this.invaderSpeed * this.scale;
                    invader.animFrame = (invader.animFrame + 1) % 2;
                }
            }
        }
    }

    private updateMotherShip(deltaTime: number): void {
        this.motherShipTimer += deltaTime;

        // Spawn mother ship randomly
        if (!this.motherShip.active && this.motherShipTimer > 15000 && Math.random() < 0.01) {
            this.motherShip.active = true;
            this.motherShip.direction = Math.random() < 0.5 ? 1 : -1;
            this.motherShip.x = this.motherShip.direction > 0 ? -50 * this.scale : this.canvas!.width + 50 * this.scale;
            this.motherShip.y = 30 * this.scale;
            this.motherShip.points = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
            this.motherShipTimer = 0;
            this.playMotherShipSound();
        }

        // Move mother ship
        if (this.motherShip.active) {
            this.motherShip.x += this.motherShip.direction * 2 * this.scale;

            // Remove if off screen
            if (this.motherShip.x < -100 * this.scale || this.motherShip.x > this.canvas!.width + 100 * this.scale) {
                this.motherShip.active = false;
            }
        }
    }

    private updateBullets(): void {
        // Update player bullets
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bullet = this.playerBullets[i];
            bullet.y -= bullet.speed;

            if (bullet.y < 0) {
                this.playerBullets.splice(i, 1);
            }
        }

        // Update invader bullets
        for (let i = this.invaderBullets.length - 1; i >= 0; i--) {
            const bullet = this.invaderBullets[i];
            bullet.y += bullet.speed;

            if (bullet.y > this.canvas!.height) {
                this.invaderBullets.splice(i, 1);
            }
        }
    }

    private shootPlayerBullet(): void {
        if (this.playerBullets.length < 1) { // Only one bullet at a time, like original
            this.playerBullets.push({
                x: this.player.x + this.player.width / 2 - 1 * this.scale,
                y: this.player.y,
                width: 2 * this.scale,
                height: 8 * this.scale,
                active: true,
                speed: 6 * this.scale
            });
            this.playShootSound();
        }
    }

    private invaderShoot(): void {
        const activeInvaders = this.invaders.filter(inv => inv.active);
        if (activeInvaders.length === 0) return;

        // Pick random invader from bottom rows
        const bottomInvaders = this.getBottomInvaders();
        if (bottomInvaders.length > 0) {
            const shooter = bottomInvaders[Math.floor(Math.random() * bottomInvaders.length)];
            this.invaderBullets.push({
                x: shooter.x + shooter.width / 2,
                y: shooter.y + shooter.height,
                width: 2 * this.scale,
                height: 8 * this.scale,
                active: true,
                speed: 3 * this.scale
            });
        }
    }

    private getBottomInvaders(): Invader[] {
        const columns: { [key: number]: Invader } = {};

        for (const invader of this.invaders) {
            if (!invader.active) continue;

            const col = Math.floor(invader.x / 40);
            if (!columns[col] || invader.y > columns[col].y) {
                columns[col] = invader;
            }
        }

        return Object.values(columns);
    }

    private checkCollisions(): void {
        // Player bullets vs invaders
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bullet = this.playerBullets[i];

            for (const invader of this.invaders) {
                if (invader.active && this.checkCollision(bullet, invader)) {
                    invader.active = false;
                    this.playerBullets.splice(i, 1);
                    this.addScore(invader.type);
                    this.playInvaderKilledSound();
                    this.increaseInvaderSpeed();
                    break;
                }
            }
        }

        // Player bullets vs mother ship
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bullet = this.playerBullets[i];

            if (this.motherShip.active && this.checkCollision(bullet, this.motherShip)) {
                this.motherShip.active = false;
                this.playerBullets.splice(i, 1);
                this.score.update(s => s + this.motherShip.points);
                this.playExplosionSound();
                break;
            }
        }

        // Player bullets vs barriers
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const bullet = this.playerBullets[i];

            for (const barrier of this.barriers) {
                if (barrier.active && this.checkCollision(bullet, barrier)) {
                    barrier.health--;
                    if (barrier.health <= 0) {
                        barrier.active = false;
                    }
                    this.playerBullets.splice(i, 1);
                    break;
                }
            }
        }

        // Invader bullets vs player
        for (let i = this.invaderBullets.length - 1; i >= 0; i--) {
            const bullet = this.invaderBullets[i];

            if (this.checkCollision(bullet, this.player)) {
                this.invaderBullets.splice(i, 1);
                this.lives.update(l => l - 1);
                this.playExplosionSound();

                if (this.lives() <= 0) {
                    this.gameOver.set(true);
                }
                break;
            }
        }

        // Invader bullets vs barriers
        for (let i = this.invaderBullets.length - 1; i >= 0; i--) {
            const bullet = this.invaderBullets[i];

            for (const barrier of this.barriers) {
                if (barrier.active && this.checkCollision(bullet, barrier)) {
                    barrier.health--;
                    if (barrier.health <= 0) {
                        barrier.active = false;
                    }
                    this.invaderBullets.splice(i, 1);
                    break;
                }
            }
        }
    }

    private checkCollision(obj1: GameObject, obj2: GameObject): boolean {
        return obj1.x < obj2.x + obj2.width &&
            obj1.x + obj1.width > obj2.x &&
            obj1.y < obj2.y + obj2.height &&
            obj1.y + obj1.height > obj2.y;
    }

    private addScore(invaderType: number): void {
        const points = [10, 20, 40][invaderType] || 10;
        this.score.update(s => s + points);
    }

    private nextLevel(): void {
        this.level.update(l => l + 1);
        this.createInvaders();
        this.invaderSpeed += 0.5;
        this.animationSpeed = Math.max(10, this.animationSpeed - 2);
        // Reset to base speed for new level, will increase as invaders are destroyed
        this.invaderSpeed = this.baseInvaderSpeed + (this.level() - 1) * 0.5;
        this.animationSpeed = Math.max(10, this.baseAnimationSpeed - (this.level() - 1) * 2);
    }

    private increaseInvaderSpeed(): void {
        // Increase speed slightly with each destroyed invader
        // Speed increase: 0.5 units per destroyed invader
        this.invaderSpeed += 0.5;

        // Decrease animation time (faster movement), minimum 300ms
        // This makes them step faster as well
        this.animationSpeed = Math.max(300, this.animationSpeed - 10);
    }

    private render(): void {
        if (!this.ctx || !this.canvas) return;

        // Clear canvas with black background
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw invaders
        for (const invader of this.invaders) {
            if (invader.active) {
                this.drawInvader(invader);
            }
        }

        // Draw mother ship
        if (this.motherShip.active) {
            this.drawMotherShip();
        }

        // Draw player
        this.drawPlayer();

        // Draw bullets
        this.ctx.fillStyle = '#FFFFFF';
        for (const bullet of this.playerBullets) {
            this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        }

        for (const bullet of this.invaderBullets) {
            this.ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        }

        // Draw barriers
        this.drawBarriers();

        // Draw game over or paused text
        if (this.gameOver()) {
            this.ctx.fillStyle = '#FF0000';
            this.ctx.font = `bold ${48 * this.scale}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.font = `${24 * this.scale}px monospace`;
            this.ctx.fillText('Press R to Restart', this.canvas.width / 2, this.canvas.height / 2 + 40 * this.scale);
        } else if (this.paused()) {
            this.ctx.fillStyle = '#FFFF00';
            this.ctx.font = `bold ${48 * this.scale}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    private drawPlayer(): void {
        if (!this.ctx) return;

        this.ctx.fillStyle = '#00FF00';

        // Simple tank shape (Atari 2600 style) - scaled up 2x to match invaders
        const x = this.player.x;
        const y = this.player.y;
        const s = this.scale * 2; // Double the size

        // Tank body
        this.ctx.fillRect(x + 8 * s, y + 10 * s, 10 * s, 6 * s);
        // Tank turret
        this.ctx.fillRect(x + 11 * s, y + 6 * s, 4 * s, 8 * s);
        // Tank barrel
        this.ctx.fillRect(x + 12 * s, y + 2 * s, 2 * s, 6 * s);
        // Tank base
        this.ctx.fillRect(x + 2 * s, y + 14 * s, 22 * s, 2 * s);
    }

    private drawInvader(invader: Invader): void {
        if (!this.ctx) return;

        const colors = ['#FFFFFF', '#00FF00', '#FF00FF'];
        this.ctx.fillStyle = colors[invader.type] || '#FFFFFF';

        const x = invader.x;
        const y = invader.y;
        const frame = invader.animFrame;
        const s = this.scale * 1.5; // Scale up by 1.5x for bigger invaders

        // Simplified pixel art for Atari 2600 style
        if (invader.type === 2) {
            // Squid (top row)
            if (frame === 0) {
                this.ctx.fillRect(x + 8 * s, y, 8 * s, 2 * s);
                this.ctx.fillRect(x + 4 * s, y + 2 * s, 16 * s, 4 * s);
                this.ctx.fillRect(x, y + 6 * s, 24 * s, 4 * s);
                this.ctx.fillRect(x + 4 * s, y + 10 * s, 4 * s, 4 * s);
                this.ctx.fillRect(x + 16 * s, y + 10 * s, 4 * s, 4 * s);
            } else {
                this.ctx.fillRect(x + 8 * s, y, 8 * s, 2 * s);
                this.ctx.fillRect(x + 4 * s, y + 2 * s, 16 * s, 4 * s);
                this.ctx.fillRect(x, y + 6 * s, 24 * s, 4 * s);
                this.ctx.fillRect(x, y + 10 * s, 4 * s, 4 * s);
                this.ctx.fillRect(x + 20 * s, y + 10 * s, 4 * s, 4 * s);
            }
        } else if (invader.type === 1) {
            // Crab (middle rows)
            if (frame === 0) {
                this.ctx.fillRect(x + 4 * s, y + 2 * s, 4 * s, 2 * s);
                this.ctx.fillRect(x + 16 * s, y + 2 * s, 4 * s, 2 * s);
                this.ctx.fillRect(x + 4 * s, y + 4 * s, 16 * s, 6 * s);
                this.ctx.fillRect(x, y + 10 * s, 8 * s, 2 * s);
                this.ctx.fillRect(x + 16 * s, y + 10 * s, 8 * s, 2 * s);
                this.ctx.fillRect(x + 4 * s, y + 12 * s, 4 * s, 2 * s);
                this.ctx.fillRect(x + 16 * s, y + 12 * s, 4 * s, 2 * s);
            } else {
                this.ctx.fillRect(x + 4 * s, y + 2 * s, 4 * s, 2 * s);
                this.ctx.fillRect(x + 16 * s, y + 2 * s, 4 * s, 2 * s);
                this.ctx.fillRect(x + 4 * s, y + 4 * s, 16 * s, 6 * s);
                this.ctx.fillRect(x + 2 * s, y + 10 * s, 4 * s, 2 * s);
                this.ctx.fillRect(x + 18 * s, y + 10 * s, 4 * s, 2 * s);
                this.ctx.fillRect(x + 2 * s, y + 12 * s, 4 * s, 2 * s);
                this.ctx.fillRect(x + 18 * s, y + 12 * s, 4 * s, 2 * s);
            }
        } else {
            // Octopus (bottom rows)
            if (frame === 0) {
                this.ctx.fillRect(x + 8 * s, y + 2 * s, 8 * s, 6 * s);
                this.ctx.fillRect(x + 4 * s, y + 8 * s, 16 * s, 4 * s);
                this.ctx.fillRect(x, y + 12 * s, 8 * s, 2 * s);
                this.ctx.fillRect(x + 16 * s, y + 12 * s, 8 * s, 2 * s);
            } else {
                this.ctx.fillRect(x + 8 * s, y + 2 * s, 8 * s, 6 * s);
                this.ctx.fillRect(x + 4 * s, y + 8 * s, 16 * s, 4 * s);
                this.ctx.fillRect(x + 4 * s, y + 12 * s, 4 * s, 2 * s);
                this.ctx.fillRect(x + 16 * s, y + 12 * s, 4 * s, 2 * s);
            }
        }
    }

    private drawMotherShip(): void {
        if (!this.ctx) return;

        this.ctx.fillStyle = '#FF0000';

        const x = this.motherShip.x;
        const y = this.motherShip.y;
        const s = this.scale;

        // Mother ship (UFO)
        this.ctx.fillRect(x + 8 * s, y, 16 * s, 4 * s);
        this.ctx.fillRect(x + 4 * s, y + 4 * s, 24 * s, 6 * s);
        this.ctx.fillRect(x + 12 * s, y + 10 * s, 8 * s, 4 * s);
    }

    private drawBarriers(): void {
        if (!this.ctx) return;

        for (const barrier of this.barriers) {
            if (barrier.active) {
                const alpha = barrier.health / 3;
                this.ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
                this.ctx.fillRect(barrier.x, barrier.y, barrier.width, barrier.height);
            }
        }
    }

    protected togglePause(): void {
        this.paused.set(!this.paused());
    }

    protected restart(): void {
        this.initGame();
        this.gameOver.set(false);
    }
}
