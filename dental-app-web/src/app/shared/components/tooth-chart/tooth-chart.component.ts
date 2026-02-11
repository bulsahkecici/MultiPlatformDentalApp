import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToothHotspot } from '../../../core/models/models';

@Component({
    selector: 'app-tooth-chart',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="tooth-chart-wrapper">
      <div class="tooth-chart-container">
        <img src="assets/mouth_chart.png" alt="Mouth Chart" class="chart-image" #chartImg>
        <svg class="chart-overlay" [attr.viewBox]="'0 0 ' + containerWidth + ' ' + containerHeight">
          <rect *ngFor="let hotspot of hotspots"
                class="hotspot"
                [class.selected]="isSelected(hotspot.toothNumber)"
                [attr.x]="hotspot.x"
                [attr.y]="hotspot.y"
                [attr.width]="hotspot.width"
                [attr.height]="hotspot.height"
                (click)="toggleTooth(hotspot.toothNumber)"
                [attr.data-tooth]="hotspot.toothNumber">
            <title>Diş {{ hotspot.toothNumber }}</title>
          </rect>
        </svg>
      </div>
      <div class="selection-info" *ngIf="selectedTeeth.length > 0">
        Seçili Dişler: {{ selectedTeeth.sort().join(', ') }}
      </div>
    </div>
  `,
    styles: [`
    .tooth-chart-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }
    .tooth-chart-container {
      position: relative;
      width: fit-content;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 10px;
      background: white;
    }
    .chart-image {
      display: block;
      max-width: 100%;
      height: auto;
    }
    .chart-overlay {
      position: absolute;
      top: 10px;
      left: 10px;
      width: calc(100% - 20px);
      height: calc(100% - 20px);
      pointer-events: none;
    }
    .hotspot {
      fill: rgba(59, 130, 246, 0.1);
      stroke: rgba(59, 130, 246, 0.3);
      stroke-width: 1;
      cursor: pointer;
      pointer-events: all;
      transition: all 0.2s;
    }
    .hotspot:hover {
      fill: rgba(59, 130, 246, 0.3);
    }
    .hotspot.selected {
      fill: rgba(59, 130, 246, 0.6);
      stroke: #2563eb;
      stroke-width: 2;
    }
    .selection-info {
      font-weight: 500;
      color: #1e40af;
      padding: 8px 16px;
      background: #eff6ff;
      border-radius: 20px;
    }
  `]
})
export class ToothChartComponent {
    @Input() selectedTeeth: number[] = [];
    @Output() teethChanged = new EventEmitter<number[]>();

    // Full FDI chart hotspot coordinates used by web mouth chart image.
    hotspots: ToothHotspot[] = [
        // Upper right quadrant (18-11)
        { toothNumber: 18, x: 300, y: 50, width: 30, height: 45 },
        { toothNumber: 17, x: 335, y: 50, width: 30, height: 45 },
        { toothNumber: 16, x: 370, y: 50, width: 30, height: 45 },
        { toothNumber: 15, x: 405, y: 50, width: 30, height: 45 },
        { toothNumber: 14, x: 440, y: 50, width: 30, height: 45 },
        { toothNumber: 13, x: 475, y: 50, width: 30, height: 45 },
        { toothNumber: 12, x: 510, y: 50, width: 30, height: 45 },
        { toothNumber: 11, x: 545, y: 50, width: 30, height: 45 },
        // Upper left quadrant (21-28)
        { toothNumber: 21, x: 270, y: 50, width: 30, height: 45 },
        { toothNumber: 22, x: 235, y: 50, width: 30, height: 45 },
        { toothNumber: 23, x: 200, y: 50, width: 30, height: 45 },
        { toothNumber: 24, x: 165, y: 50, width: 30, height: 45 },
        { toothNumber: 25, x: 130, y: 50, width: 30, height: 45 },
        { toothNumber: 26, x: 95, y: 50, width: 30, height: 45 },
        { toothNumber: 27, x: 60, y: 50, width: 30, height: 45 },
        { toothNumber: 28, x: 25, y: 50, width: 30, height: 45 },
        // Lower left quadrant (38-31)
        { toothNumber: 38, x: 25, y: 150, width: 30, height: 45 },
        { toothNumber: 37, x: 60, y: 150, width: 30, height: 45 },
        { toothNumber: 36, x: 95, y: 150, width: 30, height: 45 },
        { toothNumber: 35, x: 130, y: 150, width: 30, height: 45 },
        { toothNumber: 34, x: 165, y: 150, width: 30, height: 45 },
        { toothNumber: 33, x: 200, y: 150, width: 30, height: 45 },
        { toothNumber: 32, x: 235, y: 150, width: 30, height: 45 },
        { toothNumber: 31, x: 270, y: 150, width: 30, height: 45 },
        // Lower right quadrant (41-48)
        { toothNumber: 41, x: 545, y: 150, width: 30, height: 45 },
        { toothNumber: 42, x: 510, y: 150, width: 30, height: 45 },
        { toothNumber: 43, x: 475, y: 150, width: 30, height: 45 },
        { toothNumber: 44, x: 440, y: 150, width: 30, height: 45 },
        { toothNumber: 45, x: 405, y: 150, width: 30, height: 45 },
        { toothNumber: 46, x: 370, y: 150, width: 30, height: 45 },
        { toothNumber: 47, x: 335, y: 150, width: 30, height: 45 },
        { toothNumber: 48, x: 300, y: 150, width: 30, height: 45 }
    ];

    containerWidth = 600;
    containerHeight = 400;

    toggleTooth(toothNumber: number) {
        const index = this.selectedTeeth.indexOf(toothNumber);
        if (index === -1) {
            this.selectedTeeth.push(toothNumber);
        } else {
            this.selectedTeeth.splice(index, 1);
        }
        this.teethChanged.emit([...this.selectedTeeth]);
    }

    isSelected(toothNumber: number): boolean {
        return this.selectedTeeth.includes(toothNumber);
    }
}
