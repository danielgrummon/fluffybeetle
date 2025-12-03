import { Component, OnInit, OnDestroy, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Position {
    x: number;
    y: number;
}

interface Shape {
    pattern: number[][];
    color: string;
}

@Component({
    selector: 'app-shape-drop',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './shape-drop.component.html',
    styleUrls: ['./shape-drop.component.css']
})
export class ShapeDropComponent implements OnInit, OnDestroy {
    protected canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private animationFrameId: number = 0;

    // Game state
    protected score = signal(0);
    protected lines = signal(0);
    protected level = signal(1);
    protected gameOver = signal(false);
    protected paused = signal(false);

    // Board dimensions
    private readonly COLS = 10;
    private readonly ROWS = 20;
    private readonly BLOCK_SIZE = 30;
    private board: number[][] = [];

    // Current piece
    private currentPiece: Shape | null = null;
    private currentPosition: Position = { x: 0, y: 0 };

    // Next piece
    private nextPiece: Shape | null = null;

    // Game timing
    private lastTime = 0;
    private dropCounter = 0;
    private dropInterval = 1000; // 1 second

    // Shapes (7 classic pieces)
    private readonly SHAPES: Shape[] = [
        // I piece (cyan)
        {
            pattern: [
                [0, 0, 0, 0],
                [1, 1, 1, 1],
                [0, 0, 0, 0],
                [0, 0, 0, 0]
            ],
            color: '#00ffff'
        },
        // O piece (yellow)
        {
            pattern: [
                [1, 1],
                [1, 1]
            ],
            color: '#ffff00'
        },
        // T piece (purple)
        {
            pattern: [
                [0, 1, 0],
                [1, 1, 1],
                [0, 0, 0]
            ],
            color: '#ff00ff'
        },
        // S piece (green)
        {
            pattern: [
                [0, 1, 1],
                [1, 1, 0],
                [0, 0, 0]
            ],
            color: '#00ff00'
        },
        // Z piece (red)
        {
            pattern: [
                [1, 1, 0],
                [0, 1, 1],
                [0, 0, 0]
            ],
            color: '#ff0000'
        },
        // J piece (blue)
        {
            pattern: [
                [1, 0, 0],
                [1, 1, 1],
                [0, 0, 0]
            ],
            color: '#0000ff'
        },
        // L piece (orange)
        {
            pattern: [
                [0, 0, 1],
                [1, 1, 1],
                [0, 0, 0]
            ],
            color: '#ff7700'
        }
    ];

    // Audio context for sound effects
    private audioContext: AudioContext | null = null;

    ngOnInit(): void {
        this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            this.initAudio();
            this.initGame();
            this.gameLoop(0);
        }
    }

    @HostListener('window:resize')
    onResize(): void {
        this.resizeCanvas();
    }

    private resizeCanvas(): void {
        if (!this.canvas) return;

        // Fixed size for the game board
        this.canvas.width = this.COLS * this.BLOCK_SIZE;
        this.canvas.height = this.ROWS * this.BLOCK_SIZE;
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
        if (this.gameOver() || this.paused()) return;

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.moveLeft();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.moveRight();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.moveDown();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.rotate();
                break;
            case ' ':
                event.preventDefault();
                this.hardDrop();
                break;
            case 'p':
            case 'P':
                event.preventDefault();
                this.togglePause();
                break;
        }
    }

    private initAudio(): void {
        try {
            this.audioContext = new AudioContext();
        } catch (e) {
            console.warn('Audio not supported');
        }
    }

    private playSound(frequency: number, duration: number, type: OscillatorType = 'square'): void {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gainNode.gain.value = 0.1;

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    private playMoveSound(): void {
        this.playSound(200, 0.05);
    }

    private playRotateSound(): void {
        this.playSound(300, 0.05);
    }

    private playDropSound(): void {
        this.playSound(150, 0.1);
    }

    private playClearSound(): void {
        this.playSound(400, 0.2, 'sine');
        setTimeout(() => this.playSound(500, 0.2, 'sine'), 100);
    }

    private playGameOverSound(): void {
        this.playSound(200, 0.3);
        setTimeout(() => this.playSound(150, 0.3), 200);
        setTimeout(() => this.playSound(100, 0.5), 400);
    }

    private initGame(): void {
        // Initialize empty board
        this.board = Array(this.ROWS).fill(null).map(() => Array(this.COLS).fill(0));

        this.score.set(0);
        this.lines.set(0);
        this.level.set(1);
        this.gameOver.set(false);
        this.paused.set(false);

        this.dropInterval = 1000;
        this.dropCounter = 0;

        // Create first pieces
        this.nextPiece = this.createRandomPiece();
        this.spawnPiece();
    }

    private createRandomPiece(): Shape {
        const index = Math.floor(Math.random() * this.SHAPES.length);
        return JSON.parse(JSON.stringify(this.SHAPES[index])); // Deep copy
    }

    private spawnPiece(): void {
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.createRandomPiece();

        if (this.currentPiece) {
            this.currentPosition = {
                x: Math.floor(this.COLS / 2) - Math.floor(this.currentPiece.pattern[0].length / 2),
                y: 0
            };

            // Check if spawn position is valid
            if (!this.isValidMove(this.currentPosition.x, this.currentPosition.y, this.currentPiece.pattern)) {
                this.gameOver.set(true);
                this.playGameOverSound();
            }
        }
    }

    private isValidMove(x: number, y: number, pattern: number[][]): boolean {
        for (let row = 0; row < pattern.length; row++) {
            for (let col = 0; col < pattern[row].length; col++) {
                if (pattern[row][col]) {
                    const newX = x + col;
                    const newY = y + row;

                    // Check boundaries
                    if (newX < 0 || newX >= this.COLS || newY >= this.ROWS) {
                        return false;
                    }

                    // Check collision with existing blocks (but not if above board)
                    if (newY >= 0 && this.board[newY][newX]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    private moveLeft(): void {
        if (!this.currentPiece) return;

        if (this.isValidMove(this.currentPosition.x - 1, this.currentPosition.y, this.currentPiece.pattern)) {
            this.currentPosition.x--;
            this.playMoveSound();
        }
    }

    private moveRight(): void {
        if (!this.currentPiece) return;

        if (this.isValidMove(this.currentPosition.x + 1, this.currentPosition.y, this.currentPiece.pattern)) {
            this.currentPosition.x++;
            this.playMoveSound();
        }
    }

    private moveDown(): boolean {
        if (!this.currentPiece) return false;

        if (this.isValidMove(this.currentPosition.x, this.currentPosition.y + 1, this.currentPiece.pattern)) {
            this.currentPosition.y++;
            return true;
        } else {
            this.lockPiece();
            return false;
        }
    }

    private hardDrop(): void {
        if (!this.currentPiece) return;

        let dropDistance = 0;
        while (this.isValidMove(this.currentPosition.x, this.currentPosition.y + 1, this.currentPiece.pattern)) {
            this.currentPosition.y++;
            dropDistance++;
        }

        if (dropDistance > 0) {
            this.score.update(s => s + dropDistance * 2);
            this.playDropSound();
        }

        this.lockPiece();
    }

    private rotate(): void {
        if (!this.currentPiece) return;

        const rotated = this.rotatePattern(this.currentPiece.pattern);

        // Try basic rotation
        if (this.isValidMove(this.currentPosition.x, this.currentPosition.y, rotated)) {
            this.currentPiece.pattern = rotated;
            this.playRotateSound();
            return;
        }

        // Wall kick attempts
        const kicks = [
            { x: -1, y: 0 },  // Left
            { x: 1, y: 0 },   // Right
            { x: -2, y: 0 },  // Left 2
            { x: 2, y: 0 },   // Right 2
            { x: 0, y: -1 }   // Up
        ];

        for (const kick of kicks) {
            if (this.isValidMove(this.currentPosition.x + kick.x, this.currentPosition.y + kick.y, rotated)) {
                this.currentPiece.pattern = rotated;
                this.currentPosition.x += kick.x;
                this.currentPosition.y += kick.y;
                this.playRotateSound();
                return;
            }
        }
    }

    private rotatePattern(pattern: number[][]): number[][] {
        const size = pattern.length;
        const rotated: number[][] = Array(size).fill(null).map(() => Array(size).fill(0));

        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                rotated[col][size - 1 - row] = pattern[row][col];
            }
        }

        return rotated;
    }

    private lockPiece(): void {
        if (!this.currentPiece) return;

        // Add piece to board
        for (let row = 0; row < this.currentPiece.pattern.length; row++) {
            for (let col = 0; col < this.currentPiece.pattern[row].length; col++) {
                if (this.currentPiece.pattern[row][col]) {
                    const x = this.currentPosition.x + col;
                    const y = this.currentPosition.y + row;
                    if (y >= 0 && y < this.ROWS && x >= 0 && x < this.COLS) {
                        // Store color as a number (use color index + 1)
                        this.board[y][x] = this.SHAPES.findIndex(s => s.color === this.currentPiece!.color) + 1;
                    }
                }
            }
        }

        // Check for completed lines
        const linesCleared = this.clearLines();
        if (linesCleared > 0) {
            this.playClearSound();
            this.lines.update(l => l + linesCleared);

            // Scoring system
            const points = [0, 100, 300, 500, 800];
            this.score.update(s => s + points[linesCleared] * this.level());

            // Level up every 10 lines
            const newLevel = Math.floor(this.lines() / 10) + 1;
            if (newLevel > this.level()) {
                this.level.set(newLevel);
                this.dropInterval = Math.max(100, 1000 - (newLevel - 1) * 100);
            }
        }

        // Spawn next piece
        this.spawnPiece();
    }

    private clearLines(): number {
        let linesCleared = 0;

        for (let row = this.ROWS - 1; row >= 0; row--) {
            if (this.board[row].every(cell => cell !== 0)) {
                // Remove the line
                this.board.splice(row, 1);
                // Add new empty line at top
                this.board.unshift(Array(this.COLS).fill(0));
                linesCleared++;
                row++; // Check same row again
            }
        }

        return linesCleared;
    }

    private gameLoop(timestamp: number): void {
        if (!this.gameOver()) {
            this.animationFrameId = requestAnimationFrame((ts) => this.gameLoop(ts));
        }

        if (this.paused()) {
            this.lastTime = timestamp;
            this.render();
            return;
        }

        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.render();
    }

    private update(deltaTime: number): void {
        if (this.gameOver() || this.paused()) return;

        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            this.moveDown();
            this.dropCounter = 0;
        }
    }

    private render(): void {
        if (!this.ctx || !this.canvas) return;

        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        this.drawGrid();

        // Draw locked pieces
        this.drawBoard();

        // Draw current piece
        if (this.currentPiece) {
            this.drawPiece(this.currentPiece, this.currentPosition);
        }

        // Draw ghost piece (preview where piece will land)
        if (this.currentPiece && !this.gameOver()) {
            this.drawGhostPiece();
        }

        // Draw game over overlay
        if (this.gameOver()) {
            this.drawGameOver();
        }

        // Draw pause overlay
        if (this.paused()) {
            this.drawPause();
        }
    }

    private drawGrid(): void {
        if (!this.ctx) return;

        this.ctx.strokeStyle = '#111111';
        this.ctx.lineWidth = 1;

        // Vertical lines
        for (let col = 0; col <= this.COLS; col++) {
            this.ctx.beginPath();
            this.ctx.moveTo(col * this.BLOCK_SIZE, 0);
            this.ctx.lineTo(col * this.BLOCK_SIZE, this.canvas!.height);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let row = 0; row <= this.ROWS; row++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, row * this.BLOCK_SIZE);
            this.ctx.lineTo(this.canvas!.width, row * this.BLOCK_SIZE);
            this.ctx.stroke();
        }
    }

    private drawBoard(): void {
        for (let row = 0; row < this.ROWS; row++) {
            for (let col = 0; col < this.COLS; col++) {
                if (this.board[row][col]) {
                    const colorIndex = this.board[row][col] - 1;
                    const color = this.SHAPES[colorIndex].color;
                    this.drawBlock(col, row, color);
                }
            }
        }
    }

    private drawPiece(piece: Shape, position: Position): void {
        for (let row = 0; row < piece.pattern.length; row++) {
            for (let col = 0; col < piece.pattern[row].length; col++) {
                if (piece.pattern[row][col]) {
                    this.drawBlock(
                        position.x + col,
                        position.y + row,
                        piece.color
                    );
                }
            }
        }
    }

    private drawGhostPiece(): void {
        if (!this.currentPiece) return;

        let ghostY = this.currentPosition.y;
        while (this.isValidMove(this.currentPosition.x, ghostY + 1, this.currentPiece.pattern)) {
            ghostY++;
        }

        if (ghostY !== this.currentPosition.y) {
            for (let row = 0; row < this.currentPiece.pattern.length; row++) {
                for (let col = 0; col < this.currentPiece.pattern[row].length; col++) {
                    if (this.currentPiece.pattern[row][col]) {
                        this.drawBlock(
                            this.currentPosition.x + col,
                            ghostY + row,
                            this.currentPiece.color,
                            0.2
                        );
                    }
                }
            }
        }
    }

    private drawBlock(x: number, y: number, color: string, alpha: number = 1): void {
        if (!this.ctx) return;

        const px = x * this.BLOCK_SIZE;
        const py = y * this.BLOCK_SIZE;

        this.ctx.globalAlpha = alpha;

        // Main block
        this.ctx.fillStyle = color;
        this.ctx.fillRect(px + 1, py + 1, this.BLOCK_SIZE - 2, this.BLOCK_SIZE - 2);

        // Highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(px + 2, py + 2, this.BLOCK_SIZE - 4, 4);
        this.ctx.fillRect(px + 2, py + 2, 4, this.BLOCK_SIZE - 4);

        // Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.fillRect(px + this.BLOCK_SIZE - 6, py + 6, 4, this.BLOCK_SIZE - 8);
        this.ctx.fillRect(px + 6, py + this.BLOCK_SIZE - 6, this.BLOCK_SIZE - 8, 4);

        this.ctx.globalAlpha = 1;
    }

    private drawGameOver(): void {
        if (!this.ctx || !this.canvas) return;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 36px "Courier New"';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 20);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '20px "Courier New"';
        this.ctx.fillText('Press RESTART', this.canvas.width / 2, this.canvas.height / 2 + 30);
    }

    private drawPause(): void {
        if (!this.ctx || !this.canvas) return;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#ffff00';
        this.ctx.font = 'bold 36px "Courier New"';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
    }

    protected togglePause(): void {
        this.paused.update(p => !p);
    }

    protected restart(): void {
        this.initGame();
        this.gameLoop(performance.now());
    }
}
