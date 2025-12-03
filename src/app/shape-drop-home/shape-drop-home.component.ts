import { Component, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShapeDropComponent } from '../shape-drop/shape-drop.component';

@Component({
    selector: 'app-shape-drop-home',
    standalone: true,
    imports: [CommonModule, ShapeDropComponent],
    templateUrl: './shape-drop-home.component.html',
    styleUrls: ['./shape-drop-home.component.css']
})
export class ShapeDropHomeComponent {
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
