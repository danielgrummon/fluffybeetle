import { Component, OnInit, OnDestroy, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Point {
    x: number;
    y: number;
}

enum Direction {
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT'
}

enum GameState {
    READY = 'READY',
    PLAYING = 'PLAYING',
    PAUSED = 'PAUSED',
    GAME_OVER = 'GAME_OVER'
}

@Component({
    selector: 'app-snake-game',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './snake-game.component.html',
    styleUrls: ['./snake-game.component.css']
})
export class SnakeGameComponent implements OnInit, OnDestroy {
    // Game constants
    private readonly GRID_SIZE = 20; // Size of each grid cell in pixels
    private readonly INITIAL_SPEED = 150; // Initial game speed in ms
    private readonly SPEED_INCREMENT = 5; // Speed increase per apple eaten
    private readonly MIN_SPEED = 50; // Minimum speed (maximum difficulty)

    // Game state
    protected gameState = signal<GameState>(GameState.READY);
    protected score = signal<number>(0);
    protected highScore = signal<number>(0);

    // Grid dimensions
    protected gridWidth = signal<number>(0);
    protected gridHeight = signal<number>(0);
    protected cols = signal<number>(0);
    protected rows = signal<number>(0);

    // Snake
    private snake: Point[] = [];
    private direction: Direction = Direction.RIGHT;
    private nextDirection: Direction = Direction.RIGHT;

    // Apple
    protected apple: Point = { x: 0, y: 0 };

    // Game loop
    private gameLoop?: number;
    private currentSpeed = this.INITIAL_SPEED;

    // Audio contexts
    private audioContext?: AudioContext;
    private eatSound?: HTMLAudioElement;
    private gameOverSound?: HTMLAudioElement;

    // Expose enums to template
    protected readonly GameState = GameState;

    constructor() {
        this.loadHighScore();
    }

    ngOnInit(): void {
        this.initAudio();
        this.calculateGridDimensions();
        this.initGame();
    }

    ngOnDestroy(): void {
        this.stopGame();
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    @HostListener('window:resize')
    onResize(): void {
        const wasPlaying = this.gameState() === GameState.PLAYING;
        if (wasPlaying) {
            this.pauseGame();
        }
        this.calculateGridDimensions();
        if (wasPlaying) {
            this.resumeGame();
        }
    }

    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        const state = this.gameState();

        if (state === GameState.READY && (event.key === ' ' || event.key === 'Enter')) {
            event.preventDefault();
            this.startGame();
            return;
        }

        if (state === GameState.PLAYING) {
            switch (event.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    event.preventDefault();
                    if (this.direction !== Direction.DOWN) {
                        this.nextDirection = Direction.UP;
                    }
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    event.preventDefault();
                    if (this.direction !== Direction.UP) {
                        this.nextDirection = Direction.DOWN;
                    }
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    event.preventDefault();
                    if (this.direction !== Direction.RIGHT) {
                        this.nextDirection = Direction.LEFT;
                    }
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    event.preventDefault();
                    if (this.direction !== Direction.LEFT) {
                        this.nextDirection = Direction.RIGHT;
                    }
                    break;
                case ' ':
                case 'p':
                case 'P':
                    event.preventDefault();
                    this.pauseGame();
                    break;
            }
        } else if (state === GameState.PAUSED) {
            if (event.key === ' ' || event.key === 'p' || event.key === 'P') {
                event.preventDefault();
                this.resumeGame();
            }
        } else if (state === GameState.GAME_OVER) {
            if (event.key === ' ' || event.key === 'Enter') {
                event.preventDefault();
                this.restartGame();
            }
        }
    }

    private calculateGridDimensions(): void {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const cols = Math.floor(width / this.GRID_SIZE);
        const rows = Math.floor(height / this.GRID_SIZE);

        this.cols.set(cols);
        this.rows.set(rows);
        this.gridWidth.set(cols * this.GRID_SIZE);
        this.gridHeight.set(rows * this.GRID_SIZE);
    }

    private initAudio(): void {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    private playEatSound(): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    private playGameOverSound(): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.5);

        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.5);
    }

    private initGame(): void {
        const centerX = Math.floor(this.cols() / 2);
        const centerY = Math.floor(this.rows() / 2);

        this.snake = [
            { x: centerX, y: centerY },
            { x: centerX - 1, y: centerY },
            { x: centerX - 2, y: centerY }
        ];

        this.direction = Direction.RIGHT;
        this.nextDirection = Direction.RIGHT;
        this.currentSpeed = this.INITIAL_SPEED;
        this.score.set(0);

        this.spawnApple();
        this.gameState.set(GameState.READY);
    }

    protected startGame(): void {
        this.gameState.set(GameState.PLAYING);
        this.gameLoop = window.setInterval(() => this.update(), this.currentSpeed);
    }

    protected pauseGame(): void {
        if (this.gameState() === GameState.PLAYING) {
            this.stopGame();
            this.gameState.set(GameState.PAUSED);
        }
    }

    protected resumeGame(): void {
        if (this.gameState() === GameState.PAUSED) {
            this.gameState.set(GameState.PLAYING);
            this.gameLoop = window.setInterval(() => this.update(), this.currentSpeed);
        }
    }

    protected restartGame(): void {
        this.stopGame();
        this.initGame();
        this.startGame();
    }

    private stopGame(): void {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = undefined;
        }
    }

    private update(): void {
        this.direction = this.nextDirection;

        const head = this.snake[0];
        let newHead: Point;

        switch (this.direction) {
            case Direction.UP:
                newHead = { x: head.x, y: head.y - 1 };
                break;
            case Direction.DOWN:
                newHead = { x: head.x, y: head.y + 1 };
                break;
            case Direction.LEFT:
                newHead = { x: head.x - 1, y: head.y };
                break;
            case Direction.RIGHT:
                newHead = { x: head.x + 1, y: head.y };
                break;
        }

        // Check wall collision
        if (newHead.x < 0 || newHead.x >= this.cols() ||
            newHead.y < 0 || newHead.y >= this.rows()) {
            this.endGame();
            return;
        }

        // Check self collision
        if (this.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
            this.endGame();
            return;
        }

        this.snake.unshift(newHead);

        // Check apple collision
        if (newHead.x === this.apple.x && newHead.y === this.apple.y) {
            this.score.update(s => s + 10);
            this.playEatSound();
            this.spawnApple();

            // Increase speed
            if (this.currentSpeed > this.MIN_SPEED) {
                this.currentSpeed = Math.max(this.MIN_SPEED, this.currentSpeed - this.SPEED_INCREMENT);
                this.stopGame();
                this.gameLoop = window.setInterval(() => this.update(), this.currentSpeed);
            }
        } else {
            this.snake.pop();
        }
    }

    private spawnApple(): void {
        let newApple: Point;

        do {
            newApple = {
                x: Math.floor(Math.random() * this.cols()),
                y: Math.floor(Math.random() * this.rows())
            };
        } while (this.snake.some(segment => segment.x === newApple.x && segment.y === newApple.y));

        this.apple = newApple;
    }

    private endGame(): void {
        this.stopGame();
        this.gameState.set(GameState.GAME_OVER);
        this.playGameOverSound();

        if (this.score() > this.highScore()) {
            this.highScore.set(this.score());
            this.saveHighScore();
        }
    }

    private loadHighScore(): void {
        const saved = localStorage.getItem('snakeHighScore');
        if (saved) {
            this.highScore.set(parseInt(saved, 10));
        }
    }

    private saveHighScore(): void {
        localStorage.setItem('snakeHighScore', this.highScore().toString());
    }

    protected getSnakeSegments(): Point[] {
        return this.snake;
    }

    protected getApple(): Point {
        return this.apple;
    }

    protected getGridSize(): number {
        return this.GRID_SIZE;
    }
}
