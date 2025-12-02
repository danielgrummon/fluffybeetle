import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SnakeGameComponent } from '../snake-game/snake-game.component';

@Component({
    selector: 'app-snake-home',
    standalone: true,
    imports: [CommonModule, SnakeGameComponent],
    templateUrl: './snake-home.component.html',
    styleUrls: ['./snake-home.component.css']
})
export class SnakeHomeComponent {
    protected showGame = signal<boolean>(false);
    backToArcade = output<void>();

    startSnakeGame(): void {
        this.showGame.set(true);
    }

    backToHome(): void {
        this.showGame.set(false);
    }

    goBackToArcade(): void {
        this.backToArcade.emit();
    }
}
