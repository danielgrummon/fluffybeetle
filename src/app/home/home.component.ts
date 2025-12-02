import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InvadersHomeComponent } from '../invaders-home/invaders-home.component';
import { BustoutHomeComponent } from '../bustout-home/bustout-home.component';
import { HopperHomeComponent } from '../hopper-home/hopper-home.component';
import { SnakeHomeComponent } from '../snake-home/snake-home.component';
import { SpaceRocksHomeComponent } from '../space-rocks-home/space-rocks-home.component';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, InvadersHomeComponent, BustoutHomeComponent, HopperHomeComponent, SnakeHomeComponent, SpaceRocksHomeComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class HomeComponent {
    protected selectedGame = signal<string | null>(null);

    selectGame(game: string): void {
        this.selectedGame.set(game);
    }

    backToMenu(): void {
        this.selectedGame.set(null);
    }
}
