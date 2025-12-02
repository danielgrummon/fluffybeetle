import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpaceRocksGameComponent } from '../space-rocks-game/space-rocks-game.component';

@Component({
    selector: 'app-space-rocks-home',
    standalone: true,
    imports: [CommonModule, SpaceRocksGameComponent],
    templateUrl: './space-rocks-home.component.html',
    styleUrls: ['./space-rocks-home.component.css']
})
export class SpaceRocksHomeComponent {
    protected showGame = signal(false);
    backToArcade = output<void>();

    startGame(): void {
        this.showGame.set(true);
    }

    exitGame(): void {
        this.showGame.set(false);
    }

    goBackToArcade(): void {
        this.backToArcade.emit();
    }
}
