import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

interface GameObject {
    x: number;
    y: number;
    width: number;
    height: number;
    speed: number;
}

interface Snake extends GameObject {
    logIndex: number;
    direction: number;
    localX: number;
}

interface Alligator {
    goalIndex: number;
    isActive: boolean;
    timer: number;
    activeTime: number;
    inactiveTime: number;
}

interface FemaleFrog {
    goalIndex: number;
    isActive: boolean;
    timer: number;
    duration: number;
}

@Component({
    selector: 'app-hopper',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './hopper.component.html',
    styleUrls: ['./hopper.component.css']
})
export class HopperComponent implements OnInit, OnDestroy {
    @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

    private ctx!: CanvasRenderingContext2D;
    private animationId: number = 0;
    private audioContext!: AudioContext;

    private readonly CANVAS_WIDTH = 896;
    private readonly CANVAS_HEIGHT = 512;
    private readonly CELL_SIZE = 32;
    private readonly FROG_SIZE = 24;

    frog = { x: 14 * this.CELL_SIZE, y: 14 * this.CELL_SIZE, width: this.FROG_SIZE, height: this.FROG_SIZE, speed: 0 };

    cars: GameObject[] = [];
    logs: GameObject[] = [];
    turtles: GameObject[] = [];
    snakes: Snake[] = [];
    alligators: Alligator[] = [];
    femaleFrog: FemaleFrog | null = null;

    score = 0;
    lives = 3;
    gameOver = false;
    won = false;
    level = 1;

    goals: boolean[] = [false, false, false, false, false];

    ngOnInit(): void {
        const canvas = this.canvasRef.nativeElement;
        this.ctx = canvas.getContext('2d')!;
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.resizeCanvas();
        this.initGame();
        this.gameLoop();
    }

    ngOnDestroy(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }

    private initGame(): void {
        this.resetFrog();
        this.createObstacles();
    }

    private resizeCanvas(): void {
        const canvas = this.canvasRef.nativeElement;
        const aspectRatio = this.CANVAS_WIDTH / this.CANVAS_HEIGHT;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let width, height;

        if (viewportWidth / viewportHeight > aspectRatio) {
            height = viewportHeight;
            width = height * aspectRatio;
        } else {
            width = viewportWidth;
            height = width / aspectRatio;
        }

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    }

    @HostListener('window:resize')
    onResize(): void {
        this.resizeCanvas();
    }

    private createObstacles(): void {
        const speedMultiplier = 0.3 + (this.level - 1) * 0.15;

        this.cars = [
            { x: 0, y: 8 * this.CELL_SIZE, width: 48, height: 24, speed: 2 * speedMultiplier },
            { x: 200, y: 8 * this.CELL_SIZE, width: 48, height: 24, speed: 2 * speedMultiplier },
            { x: 400, y: 8 * this.CELL_SIZE, width: 48, height: 24, speed: 2 * speedMultiplier },
            { x: 600, y: 8 * this.CELL_SIZE, width: 48, height: 24, speed: 2 * speedMultiplier },
            { x: 0, y: 9 * this.CELL_SIZE, width: 40, height: 24, speed: -1.5 * speedMultiplier },
            { x: 250, y: 9 * this.CELL_SIZE, width: 40, height: 24, speed: -1.5 * speedMultiplier },
            { x: 500, y: 9 * this.CELL_SIZE, width: 40, height: 24, speed: -1.5 * speedMultiplier },
            { x: 750, y: 9 * this.CELL_SIZE, width: 40, height: 24, speed: -1.5 * speedMultiplier },
            { x: 0, y: 10 * this.CELL_SIZE, width: 56, height: 24, speed: 3 * speedMultiplier },
            { x: 300, y: 10 * this.CELL_SIZE, width: 56, height: 24, speed: 3 * speedMultiplier },
            { x: 600, y: 10 * this.CELL_SIZE, width: 56, height: 24, speed: 3 * speedMultiplier },
            { x: 0, y: 11 * this.CELL_SIZE, width: 40, height: 24, speed: -2.5 * speedMultiplier },
            { x: 220, y: 11 * this.CELL_SIZE, width: 40, height: 24, speed: -2.5 * speedMultiplier },
            { x: 440, y: 11 * this.CELL_SIZE, width: 40, height: 24, speed: -2.5 * speedMultiplier },
            { x: 660, y: 11 * this.CELL_SIZE, width: 40, height: 24, speed: -2.5 * speedMultiplier },
            { x: 0, y: 12 * this.CELL_SIZE, width: 48, height: 24, speed: 1.5 * speedMultiplier },
            { x: 250, y: 12 * this.CELL_SIZE, width: 48, height: 24, speed: 1.5 * speedMultiplier },
            { x: 500, y: 12 * this.CELL_SIZE, width: 48, height: 24, speed: 1.5 * speedMultiplier },
            { x: 750, y: 12 * this.CELL_SIZE, width: 48, height: 24, speed: 1.5 * speedMultiplier },
        ];

        this.logs = [
            { x: 0, y: 2 * this.CELL_SIZE, width: 128, height: 24, speed: 1.5 * speedMultiplier },
            { x: 300, y: 2 * this.CELL_SIZE, width: 128, height: 24, speed: 1.5 * speedMultiplier },
            { x: 600, y: 2 * this.CELL_SIZE, width: 128, height: 24, speed: 1.5 * speedMultiplier },
            { x: 0, y: 3 * this.CELL_SIZE, width: 160, height: 24, speed: -2 * speedMultiplier },
            { x: 350, y: 3 * this.CELL_SIZE, width: 160, height: 24, speed: -2 * speedMultiplier },
            { x: 700, y: 3 * this.CELL_SIZE, width: 160, height: 24, speed: -2 * speedMultiplier },
            { x: 0, y: 5 * this.CELL_SIZE, width: 96, height: 24, speed: 2.5 * speedMultiplier },
            { x: 250, y: 5 * this.CELL_SIZE, width: 96, height: 24, speed: 2.5 * speedMultiplier },
            { x: 500, y: 5 * this.CELL_SIZE, width: 96, height: 24, speed: 2.5 * speedMultiplier },
            { x: 750, y: 5 * this.CELL_SIZE, width: 96, height: 24, speed: 2.5 * speedMultiplier },
        ];

        this.turtles = [
            { x: 0, y: 4 * this.CELL_SIZE, width: 72, height: 24, speed: -1 * speedMultiplier },
            { x: 220, y: 4 * this.CELL_SIZE, width: 72, height: 24, speed: -1 * speedMultiplier },
            { x: 440, y: 4 * this.CELL_SIZE, width: 72, height: 24, speed: -1 * speedMultiplier },
            { x: 660, y: 4 * this.CELL_SIZE, width: 72, height: 24, speed: -1 * speedMultiplier },
            { x: 0, y: 6 * this.CELL_SIZE, width: 80, height: 24, speed: 1.8 * speedMultiplier },
            { x: 250, y: 6 * this.CELL_SIZE, width: 80, height: 24, speed: 1.8 * speedMultiplier },
            { x: 500, y: 6 * this.CELL_SIZE, width: 80, height: 24, speed: 1.8 * speedMultiplier },
            { x: 750, y: 6 * this.CELL_SIZE, width: 80, height: 24, speed: 1.8 * speedMultiplier },
        ];

        this.snakes = [];
        if (this.level >= 2) {
            this.snakes.push({ x: 0, y: 2 * this.CELL_SIZE, width: 32, height: 20, speed: 0.8, logIndex: 1, direction: 1, localX: 20 });
        }
        if (this.level >= 3) {
            this.snakes.push({ x: 0, y: 3 * this.CELL_SIZE, width: 32, height: 20, speed: 0.8, logIndex: 4, direction: -1, localX: 80 });
        }
        if (this.level >= 5) {
            this.snakes.push({ x: 0, y: 5 * this.CELL_SIZE, width: 32, height: 20, speed: 0.8, logIndex: 7, direction: 1, localX: 30 });
        }

        this.alligators = [];
        if (this.level >= 3) {
            const alligatorGoals = this.level >= 6 ? [0, 2, 4] : this.level >= 4 ? [1, 3] : [2];
            alligatorGoals.forEach(goalIndex => {
                this.alligators.push({ goalIndex, isActive: false, timer: Math.random() * 180 + 60, activeTime: 120, inactiveTime: 180 });
            });
        }

        this.femaleFrog = null;
        if (this.level >= 2 && Math.random() < 0.3) {
            const emptyGoals = [];
            for (let i = 0; i < 5; i++) {
                if (!this.goals[i]) emptyGoals.push(i);
            }
            if (emptyGoals.length > 0) {
                const randomGoal = emptyGoals[Math.floor(Math.random() * emptyGoals.length)];
                this.femaleFrog = { goalIndex: randomGoal, isActive: true, timer: 600, duration: 600 };
            }
        }
    }

    private gameLoop = (): void => {
        this.update();
        this.render();
        this.animationId = requestAnimationFrame(this.gameLoop);
    }

    private update(): void {
        if (this.gameOver || this.won) return;

        this.cars.forEach(car => {
            car.x += car.speed;
            if (car.speed > 0 && car.x > this.CANVAS_WIDTH) car.x = -car.width;
            if (car.speed < 0 && car.x < -car.width) car.x = this.CANVAS_WIDTH;
        });

        this.logs.forEach(log => {
            log.x += log.speed;
            if (log.speed > 0 && log.x > this.CANVAS_WIDTH) log.x = -log.width;
            if (log.speed < 0 && log.x < -log.width) log.x = this.CANVAS_WIDTH;
        });

        this.turtles.forEach(turtle => {
            turtle.x += turtle.speed;
            if (turtle.speed > 0 && turtle.x > this.CANVAS_WIDTH) turtle.x = -turtle.width;
            if (turtle.speed < 0 && turtle.x < -turtle.width) turtle.x = this.CANVAS_WIDTH;
        });

        this.snakes.forEach(snake => {
            const log = this.logs[snake.logIndex];
            snake.localX += snake.speed * snake.direction;
            if (snake.localX <= 0 || snake.localX >= log.width - snake.width) {
                snake.direction *= -1;
                snake.localX = Math.max(0, Math.min(log.width - snake.width, snake.localX));
            }
            snake.x = log.x + snake.localX;
            snake.y = log.y;
            snake.speed = log.speed;
        });

        this.alligators.forEach(gator => {
            gator.timer--;
            if (gator.timer <= 0) {
                gator.isActive = !gator.isActive;
                gator.timer = gator.isActive ? gator.activeTime : gator.inactiveTime;
            }
        });

        if (this.femaleFrog) {
            this.femaleFrog.timer--;
            if (this.femaleFrog.timer <= 0) this.femaleFrog = null;
        }

        this.checkCollisions();
    }

    private playSound(frequency: number, duration: number, type: OscillatorType = 'square'): void {
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            oscillator.frequency.value = frequency;
            oscillator.type = type;
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        } catch (e) { }
    }

    private playHopSound(): void { this.playSound(200, 0.1); }
    private playGoalSound(): void { this.playSound(600, 0.2); setTimeout(() => this.playSound(800, 0.2), 100); }
    private playDeathSound(): void { this.playSound(100, 0.3, 'sawtooth'); setTimeout(() => this.playSound(80, 0.3, 'sawtooth'), 150); }
    private playLevelUpSound(): void { this.playSound(400, 0.15); setTimeout(() => this.playSound(500, 0.15), 100); setTimeout(() => this.playSound(600, 0.15), 200); setTimeout(() => this.playSound(800, 0.3), 300); }
    private playBonusSound(): void { this.playSound(800, 0.1); setTimeout(() => this.playSound(1000, 0.1), 100); setTimeout(() => this.playSound(1200, 0.1), 200); setTimeout(() => this.playSound(1500, 0.2), 300); }
    private playGameOverSound(): void { this.playSound(300, 0.2, 'sawtooth'); setTimeout(() => this.playSound(250, 0.2, 'sawtooth'), 200); setTimeout(() => this.playSound(200, 0.2, 'sawtooth'), 400); setTimeout(() => this.playSound(150, 0.5, 'sawtooth'), 600); }

    private checkCollisions(): void {
        const frogRow = Math.floor(this.frog.y / this.CELL_SIZE);

        if (frogRow === 1) {
            const goalIndex = Math.floor((this.frog.x + this.FROG_SIZE / 2) / (this.CANVAS_WIDTH / 5));
            const goalX = goalIndex * (this.CANVAS_WIDTH / 5) + 60;
            const goalWidth = 80;

            if (goalIndex >= 0 && goalIndex < 5 && this.frog.x + this.FROG_SIZE > goalX && this.frog.x < goalX + goalWidth) {
                const alligator = this.alligators.find(g => g.goalIndex === goalIndex);
                if (alligator && alligator.isActive) {
                    this.loseLife();
                    return;
                }

                let bonusPoints = 0;
                if (this.femaleFrog && this.femaleFrog.goalIndex === goalIndex && this.femaleFrog.isActive) {
                    bonusPoints = 500;
                    this.femaleFrog = null;
                    this.playBonusSound();
                }

                if (!this.goals[goalIndex]) {
                    this.goals[goalIndex] = true;
                    this.score += 100 + bonusPoints;
                    if (bonusPoints === 0) this.playGoalSound();
                    this.resetFrog();

                    if (this.goals.every(g => g)) {
                        this.level++;
                        this.playLevelUpSound();
                        this.goals = [false, false, false, false, false];
                        this.createObstacles();
                        this.resetFrog();
                    }
                } else {
                    this.loseLife();
                }
            } else {
                this.loseLife();
            }
            return;
        }

        if (frogRow >= 2 && frogRow <= 6) {
            let onPlatform = false;
            [...this.logs, ...this.turtles].forEach(platform => {
                if (this.checkOverlap(this.frog, platform)) {
                    onPlatform = true;
                    this.frog.x += platform.speed;
                }
            });

            if (!onPlatform || this.frog.x < 0 || this.frog.x > this.CANVAS_WIDTH - this.FROG_SIZE) {
                this.loseLife();
                return;
            }

            this.snakes.forEach(snake => {
                if (this.checkOverlap(this.frog, snake)) this.loseLife();
            });
        }

        if (frogRow >= 8 && frogRow <= 12) {
            this.cars.forEach(car => {
                if (this.checkOverlap(this.frog, car)) this.loseLife();
            });
        }
    }

    private checkOverlap(a: GameObject, b: GameObject): boolean {
        return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    private loseLife(): void {
        this.lives--;
        this.playDeathSound();
        if (this.lives <= 0) {
            this.gameOver = true;
            this.playGameOverSound();
        } else {
            this.resetFrog();
        }
    }

    private resetFrog(): void {
        this.frog.x = 14 * this.CELL_SIZE;
        this.frog.y = 14 * this.CELL_SIZE;
    }

    private render(): void {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

        this.ctx.fillStyle = '#0000AA';
        this.ctx.fillRect(0, 2 * this.CELL_SIZE, this.CANVAS_WIDTH, 5 * this.CELL_SIZE);

        this.ctx.fillStyle = '#00AA00';
        this.ctx.fillRect(0, 7 * this.CELL_SIZE, this.CANVAS_WIDTH, this.CELL_SIZE);
        this.ctx.fillRect(0, 13 * this.CELL_SIZE, this.CANVAS_WIDTH, this.CELL_SIZE);

        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(0, 8 * this.CELL_SIZE, this.CANVAS_WIDTH, 5 * this.CELL_SIZE);

        this.ctx.fillStyle = '#00AA00';
        this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, 2 * this.CELL_SIZE);

        for (let i = 0; i < 5; i++) {
            const goalX = i * (this.CANVAS_WIDTH / 5) + 60;
            const alligator = this.alligators.find(g => g.goalIndex === i);
            const isAlligatorActive = alligator && alligator.isActive;
            const hasFemaleFrog = this.femaleFrog && this.femaleFrog.goalIndex === i && this.femaleFrog.isActive;

            if (isAlligatorActive && !this.goals[i]) {
                this.ctx.fillStyle = '#006600';
                this.ctx.fillRect(goalX, this.CELL_SIZE, 80, this.CELL_SIZE);
                this.ctx.fillStyle = '#2D5016';
                this.ctx.fillRect(goalX + 10, this.CELL_SIZE + 8, 60, 16);
                this.ctx.fillStyle = '#3D6026';
                this.ctx.fillRect(goalX + 55, this.CELL_SIZE + 6, 20, 20);
                this.ctx.fillStyle = '#FFFF00';
                this.ctx.fillRect(goalX + 60, this.CELL_SIZE + 8, 4, 4);
                this.ctx.fillRect(goalX + 68, this.CELL_SIZE + 8, 4, 4);
                this.ctx.fillStyle = '#FFFFFF';
                for (let t = 0; t < 3; t++) this.ctx.fillRect(goalX + 58 + t * 6, this.CELL_SIZE + 18, 2, 4);
                this.ctx.fillStyle = '#2D5016';
                for (let s = 0; s < 4; s++) {
                    const segWidth = 8 - s * 1.5;
                    this.ctx.fillRect(goalX + 15 + s * 8, this.CELL_SIZE + 12, segWidth, 8);
                }
            } else if (hasFemaleFrog && !this.goals[i]) {
                this.ctx.fillStyle = '#006600';
                this.ctx.fillRect(goalX, this.CELL_SIZE, 80, this.CELL_SIZE);
                this.ctx.fillStyle = '#FF69B4';
                this.ctx.fillRect(goalX + 28, this.CELL_SIZE + 8, 24, 16);
                this.ctx.fillStyle = '#FFB6C1';
                this.ctx.fillRect(goalX + 30, this.CELL_SIZE + 6, 20, 12);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fillRect(goalX + 32, this.CELL_SIZE + 7, 6, 6);
                this.ctx.fillRect(goalX + 42, this.CELL_SIZE + 7, 6, 6);
                this.ctx.fillStyle = '#000000';
                this.ctx.fillRect(goalX + 34, this.CELL_SIZE + 9, 2, 2);
                this.ctx.fillRect(goalX + 44, this.CELL_SIZE + 9, 2, 2);
                this.ctx.fillStyle = '#FF0000';
                this.ctx.fillRect(goalX + 40, this.CELL_SIZE + 4, 8, 4);
                this.ctx.fillRect(goalX + 42, this.CELL_SIZE + 2, 4, 2);
                if (this.femaleFrog && this.femaleFrog.timer < 180) {
                    const alpha = 0.3 + (Math.sin(this.femaleFrog.timer / 10) * 0.3);
                    this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
                    this.ctx.fillRect(goalX + 2, this.CELL_SIZE + 2, 76, 28);
                }
            } else {
                this.ctx.fillStyle = this.goals[i] ? '#00FF00' : '#006600';
                this.ctx.fillRect(goalX, this.CELL_SIZE, 80, this.CELL_SIZE);
            }
        }

        this.ctx.fillStyle = '#8B4513';
        this.logs.forEach(log => this.ctx.fillRect(log.x, log.y, log.width, log.height));

        this.ctx.fillStyle = '#228B22';
        this.turtles.forEach(turtle => this.ctx.fillRect(turtle.x, turtle.y, turtle.width, turtle.height));

        this.snakes.forEach(snake => {
            this.ctx.fillStyle = '#FF6600';
            this.ctx.fillRect(snake.x, snake.y + 2, snake.width, snake.height);
            this.ctx.fillStyle = '#CC3300';
            const headX = snake.direction > 0 ? snake.x + snake.width - 8 : snake.x;
            this.ctx.fillRect(headX, snake.y + 2, 8, snake.height);
            this.ctx.fillStyle = '#FFFF00';
            const eyeY = snake.y + 6;
            if (snake.direction > 0) {
                this.ctx.fillRect(headX + 5, eyeY, 2, 2);
                this.ctx.fillRect(headX + 5, eyeY + 8, 2, 2);
            } else {
                this.ctx.fillRect(headX + 1, eyeY, 2, 2);
                this.ctx.fillRect(headX + 1, eyeY + 8, 2, 2);
            }
        });

        this.cars.forEach((car, i) => {
            this.ctx.fillStyle = i % 2 === 0 ? '#FF0000' : '#FFFF00';
            this.ctx.fillRect(car.x, car.y, car.width, car.height);
        });

        this.ctx.fillStyle = '#00FF00';
        this.ctx.fillRect(this.frog.x, this.frog.y, this.frog.width, this.frog.height);

        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px monospace';
        this.ctx.fillText(`SCORE: ${this.score}`, 10, 20);
        this.ctx.fillText(`LIVES: ${this.lives}`, 380, 20);
        this.ctx.fillText(`LEVEL: ${this.level}`, 750, 20);

        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
            this.ctx.fillStyle = '#FF0000';
            this.ctx.font = '48px monospace';
            this.ctx.fillText('GAME OVER', 280, 250);
        }

        if (this.won) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = '48px monospace';
            this.ctx.fillText('YOU WIN!', 320, 250);
        }
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyDown(event: KeyboardEvent): void {
        const moveAmount = this.CELL_SIZE;

        if (event.key === 'Enter') {
            if (this.gameOver || this.won) this.resetGame();
            event.preventDefault();
            return;
        }

        if (event.key === 'n' || event.key === 'N') {
            this.level++;
            this.goals = [false, false, false, false, false];
            this.createObstacles();
            this.resetFrog();
            this.playLevelUpSound();
            event.preventDefault();
            return;
        }

        if (this.gameOver || this.won) return;

        switch (event.key) {
            case 'ArrowUp': case 'w': case 'W':
                if (this.frog.y > this.CELL_SIZE) {
                    this.frog.y -= moveAmount;
                    this.score += 10;
                    this.playHopSound();
                }
                break;
            case 'ArrowDown': case 's': case 'S':
                if (this.frog.y < 14 * this.CELL_SIZE) {
                    this.frog.y += moveAmount;
                    this.playHopSound();
                }
                break;
            case 'ArrowLeft': case 'a': case 'A':
                if (this.frog.x > 0) {
                    this.frog.x -= moveAmount;
                    this.playHopSound();
                }
                break;
            case 'ArrowRight': case 'd': case 'D':
                if (this.frog.x < this.CANVAS_WIDTH - this.FROG_SIZE) {
                    this.frog.x += moveAmount;
                    this.playHopSound();
                }
                break;
        }
        event.preventDefault();
    }

    resetGame(): void {
        this.score = 0;
        this.lives = 3;
        this.gameOver = false;
        this.won = false;
        this.level = 1;
        this.goals = [false, false, false, false, false];
        this.createObstacles();
        this.resetFrog();
    }
}