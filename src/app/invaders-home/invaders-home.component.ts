import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlienInvadersComponent } from '../alien-invaders/alien-invaders.component';

@Component({
    selector: 'app-invaders-home',
    standalone: true,
    imports: [CommonModule, AlienInvadersComponent],
    templateUrl: './invaders-home.component.html',
    styleUrls: ['./invaders-home.component.css']
})
export class InvadersHomeComponent {
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
