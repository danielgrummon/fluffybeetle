import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HopperComponent } from '../hopper/hopper.component';

@Component({
    selector: 'app-hopper-home',
    standalone: true,
    imports: [CommonModule, HopperComponent],
    templateUrl: './hopper-home.component.html',
    styleUrls: ['./hopper-home.component.css']
})
export class HopperHomeComponent {
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
