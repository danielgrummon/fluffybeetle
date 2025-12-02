import { Component, OnInit, OnDestroy, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Brick {
    x: number;
    y: number;
    width: number;
    height: number;
    active: boolean;
    color: string;
    points: number;
}

interface Ball {
    x: number;
    y: number;
    dx: number;
    dy: number;
    radius: number;
}

@Component({
    selector: 'app-bustout-game',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './bustout-game.component.html',
    styleUrl: './bustout-game.component.css'
})
export class BustoutGameComponent implements OnInit, OnDestroy {
    private canvas!: HTMLCanvasElement;
    private ctx!: CanvasRenderingContext2D;
    private animationFrameId: number = 0;

    // Game state
    protected gameStarted = signal(false);
    protected gameOver = signal(false);
    protected score = signal(0);
    protected lives = signal(5);
    protected level = signal(1);

    // Paddle
    private paddleWidth = 80;
    private paddleHeight = 12;
    private paddleX = 0;
    private paddleSpeed = 8;
    private rightPressed = false;
    private leftPressed = false;

    // Ball
    private balls: Ball[] = [];
    private ballSpeed = 4;

    // Bricks
    private bricks: Brick[] = [];
    private brickRowCount = 8;
    private brickColumnCount = 14;
    private brickWidth = 0;
    private brickHeight = 20;
    private brickPadding = 4;
    private brickOffsetTop = 60;
    private brickOffsetLeft = 4;

    // Atari 2600 color palette
    private readonly colors = [
        '#D85050', // Red
        '#E06060', // Light Red
        '#E88038', // Orange
        '#F0A848', // Yellow-Orange
        '#A8C030', // Yellow-Green
        '#58B850', // Green
        '#40A0D0', // Blue
        '#8888D8', // Light Blue
    ];

    // Audio context for sound effects
    private audioContext: AudioContext | null = null;

    ngOnInit(): void {
        setTimeout(() => this.initCanvas(), 0);
        this.initAudio();
    }

    private initAudio(): void {
        try {
            this.audioContext = new AudioContext();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    // Sound effect methods
    private playPaddleHitSound(): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    private playBrickHitSound(points: number): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Higher frequency for higher point bricks
        const baseFreq = 300 + (points * 2);
        oscillator.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }

    private playWallHitSound(): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.08);
    }

    private playLoseLifeSound(): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.5);
        oscillator.type = 'sawtooth';

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }

    private playGameOverSound(): void {
        if (!this.audioContext) return;

        // Create a sequence of descending tones
        const times = [0, 0.15, 0.3, 0.45];
        const frequencies = [300, 250, 200, 150];

        times.forEach((time, index) => {
            const oscillator = this.audioContext!.createOscillator();
            const gainNode = this.audioContext!.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext!.destination);

            oscillator.frequency.setValueAtTime(frequencies[index], this.audioContext!.currentTime + time);
            oscillator.type = 'square';

            gainNode.gain.setValueAtTime(0.2, this.audioContext!.currentTime + time);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + time + 0.15);

            oscillator.start(this.audioContext!.currentTime + time);
            oscillator.stop(this.audioContext!.currentTime + time + 0.15);
        });
    }

    private playLevelUpSound(): void {
        if (!this.audioContext) return;

        // Create an ascending sequence of tones
        const times = [0, 0.1, 0.2, 0.3];
        const frequencies = [300, 400, 500, 600];

        times.forEach((time, index) => {
            const oscillator = this.audioContext!.createOscillator();
            const gainNode = this.audioContext!.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext!.destination);

            oscillator.frequency.setValueAtTime(frequencies[index], this.audioContext!.currentTime + time);
            oscillator.type = 'square';

            gainNode.gain.setValueAtTime(0.2, this.audioContext!.currentTime + time);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + time + 0.1);

            oscillator.start(this.audioContext!.currentTime + time);
            oscillator.stop(this.audioContext!.currentTime + time + 0.1);
        });
    }

    ngOnDestroy(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent): void {
        if (event.key === 'Right' || event.key === 'ArrowRight' || event.key === 'd') {
            this.rightPressed = true;
        } else if (event.key === 'Left' || event.key === 'ArrowLeft' || event.key === 'a') {
            this.leftPressed = true;
        } else if (event.key === ' ' && !this.gameStarted()) {
            this.startGame();
        } else if (event.key === 'r' && this.gameOver()) {
            this.resetGame();
        }
    }

    @HostListener('window:keyup', ['$event'])
    handleKeyUp(event: KeyboardEvent): void {
        if (event.key === 'Right' || event.key === 'ArrowRight' || event.key === 'd') {
            this.rightPressed = false;
        } else if (event.key === 'Left' || event.key === 'ArrowLeft' || event.key === 'a') {
            this.leftPressed = false;
        }
    }

    @HostListener('window:mousemove', ['$event'])
    handleMouseMove(event: MouseEvent): void {
        if (this.canvas) {
            const rect = this.canvas.getBoundingClientRect();
            const relativeX = event.clientX - rect.left;
            if (relativeX > 0 && relativeX < this.canvas.width) {
                this.paddleX = relativeX - this.paddleWidth / 2;
            }
        }
    }

    @HostListener('window:resize')
    handleResize(): void {
        this.initCanvas();
    }

    private initCanvas(): void {
        this.canvas = document.getElementById('bustoutCanvas') as HTMLCanvasElement;
        if (!this.canvas) return;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;
        this.ctx = ctx;

        // Set canvas to full window size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        this.paddleX = (this.canvas.width - this.paddleWidth) / 2;
        this.brickWidth = (this.canvas.width - this.brickOffsetLeft * 2 - (this.brickColumnCount - 1) * this.brickPadding) / this.brickColumnCount;

        this.initBricks();
        this.draw();
    }

    private initBricks(): void {
        this.bricks = [];
        for (let row = 0; row < this.brickRowCount; row++) {
            for (let col = 0; col < this.brickColumnCount; col++) {
                const x = col * (this.brickWidth + this.brickPadding) + this.brickOffsetLeft;
                const y = row * (this.brickHeight + this.brickPadding) + this.brickOffsetTop;
                const colorIndex = row % this.colors.length;
                const points = (this.brickRowCount - row) * 10;

                this.bricks.push({
                    x,
                    y,
                    width: this.brickWidth,
                    height: this.brickHeight,
                    active: true,
                    color: this.colors[colorIndex],
                    points
                });
            }
        }
    }

    protected startGame(): void {
        this.gameStarted.set(true);
        this.gameOver.set(false);

        // Resume audio context on user interaction (required by browsers)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Initialize ball
        this.balls = [{
            x: this.canvas.width / 2,
            y: this.canvas.height - 100,
            dx: this.ballSpeed * (Math.random() > 0.5 ? 1 : -1),
            dy: -this.ballSpeed,
            radius: 6
        }];

        this.gameLoop();
    }

    protected resetGame(): void {
        this.score.set(0);
        this.lives.set(5);
        this.level.set(1);
        this.gameStarted.set(false);
        this.gameOver.set(false);
        this.balls = [];
        this.initBricks();
        this.draw();
    }

    private gameLoop(): void {
        this.update();
        this.draw();

        if (this.gameStarted() && !this.gameOver()) {
            this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
        }
    }

    private update(): void {
        // Move paddle
        if (this.rightPressed && this.paddleX < this.canvas.width - this.paddleWidth) {
            this.paddleX += this.paddleSpeed;
        }
        if (this.leftPressed && this.paddleX > 0) {
            this.paddleX -= this.paddleSpeed;
        }

        // Update balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];

            ball.x += ball.dx;
            ball.y += ball.dy;

            // Wall collision
            if (ball.x + ball.radius > this.canvas.width || ball.x - ball.radius < 0) {
                ball.dx = -ball.dx;
                this.playWallHitSound();
            }

            // Top collision
            if (ball.y - ball.radius < 0) {
                ball.dy = -ball.dy;
                this.playWallHitSound();
            }

            // Paddle collision
            if (
                ball.y + ball.radius > this.canvas.height - this.paddleHeight - 20 &&
                ball.y + ball.radius < this.canvas.height - 15 &&
                ball.x > this.paddleX &&
                ball.x < this.paddleX + this.paddleWidth
            ) {
                // Add spin based on where ball hits paddle
                const hitPos = (ball.x - this.paddleX) / this.paddleWidth;
                ball.dx = (hitPos - 0.5) * this.ballSpeed * 2;
                ball.dy = -Math.abs(ball.dy);
                this.playPaddleHitSound();
            }

            // Bottom collision (lose life)
            if (ball.y + ball.radius > this.canvas.height) {
                this.balls.splice(i, 1);

                if (this.balls.length === 0) {
                    this.lives.update(lives => lives - 1);

                    if (this.lives() <= 0) {
                        this.gameOver.set(true);
                        this.gameStarted.set(false);
                        this.playGameOverSound();
                    } else {
                        this.playLoseLifeSound();
                        // Respawn ball
                        this.balls.push({
                            x: this.canvas.width / 2,
                            y: this.canvas.height - 100,
                            dx: this.ballSpeed * (Math.random() > 0.5 ? 1 : -1),
                            dy: -this.ballSpeed,
                            radius: 6
                        });
                    }
                }
                continue;
            }

            // Brick collision
            for (const brick of this.bricks) {
                if (!brick.active) continue;

                if (
                    ball.x + ball.radius > brick.x &&
                    ball.x - ball.radius < brick.x + brick.width &&
                    ball.y + ball.radius > brick.y &&
                    ball.y - ball.radius < brick.y + brick.height
                ) {
                    ball.dy = -ball.dy;
                    brick.active = false;
                    this.score.update(score => score + brick.points);
                    this.playBrickHitSound(brick.points);
                    break;
                }
            }
        }

        // Check if all bricks destroyed
        const activeBricks = this.bricks.filter(b => b.active).length;
        if (activeBricks === 0) {
            this.level.update(level => level + 1);
            this.ballSpeed += 0.5;
            this.playLevelUpSound();
            this.initBricks();

            // Reset ball position
            this.balls = [{
                x: this.canvas.width / 2,
                y: this.canvas.height - 100,
                dx: this.ballSpeed * (Math.random() > 0.5 ? 1 : -1),
                dy: -this.ballSpeed,
                radius: 6
            }];
        }
    }

    private draw(): void {
        if (!this.ctx || !this.canvas) return;

        // Clear canvas with Atari-style black background
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw bricks
        for (const brick of this.bricks) {
            if (brick.active) {
                this.ctx.fillStyle = brick.color;
                this.ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

                // Add a slight 3D effect
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 1;
                this.ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
            }
        }

        // Draw paddle
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(this.paddleX, this.canvas.height - this.paddleHeight - 20, this.paddleWidth, this.paddleHeight);

        // Draw balls
        for (const ball of this.balls) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw score and lives
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 24px "Courier New", monospace';
        this.ctx.fillText(`SCORE: ${this.score()}`, 20, 30);
        this.ctx.fillText(`LIVES: ${this.lives()}`, this.canvas.width - 150, 30);
        this.ctx.fillText(`LEVEL: ${this.level()}`, this.canvas.width / 2 - 50, 30);

        // Draw start message
        if (!this.gameStarted() && !this.gameOver()) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 48px "Courier New", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('SUPER BUSTOUT', this.canvas.width / 2, this.canvas.height / 2 - 60);

            this.ctx.font = 'bold 24px "Courier New", monospace';
            this.ctx.fillText('Press SPACE to Start', this.canvas.width / 2, this.canvas.height / 2 + 20);
            this.ctx.fillText('Use Arrow Keys or Mouse to Move', this.canvas.width / 2, this.canvas.height / 2 + 60);
            this.ctx.textAlign = 'left';
        }

        // Draw game over message
        if (this.gameOver()) {
            this.ctx.fillStyle = '#FF0000';
            this.ctx.font = 'bold 72px "Courier New", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);

            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 32px "Courier New", monospace';
            this.ctx.fillText(`Final Score: ${this.score()}`, this.canvas.width / 2, this.canvas.height / 2 + 20);
            this.ctx.font = 'bold 24px "Courier New", monospace';
            this.ctx.fillText('Press R to Restart', this.canvas.width / 2, this.canvas.height / 2 + 80);
            this.ctx.textAlign = 'left';
        }
    }
}
