import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BustoutGameComponent } from '../bustout-game/bustout-game.component';

@Component({
    selector: 'app-bustout-home',
    standalone: true,
    imports: [CommonModule, BustoutGameComponent],
    templateUrl: './bustout-home.component.html',
    styleUrl: './bustout-home.component.css'
})
export class BustoutHomeComponent {
    protected gameStarted = signal(false);
    backToArcade = output<void>();

    startGame(): void {
        this.gameStarted.set(true);
    }

    exitGame(): void {
        this.gameStarted.set(false);
    }

    goBackToArcade(): void {
        this.backToArcade.emit();
    }
}
