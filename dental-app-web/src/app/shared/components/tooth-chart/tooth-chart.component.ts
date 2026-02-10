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

    // FDI numbering system coordinates (matched from Desktop app)
    hotspots: ToothHotspot[] = [
        // Upper Right (11-18)
        { toothNumber: 11, x: 200, y: 50, width: 40, height: 50 },
        { toothNumber: 12, x: 250, y: 50, width: 40, height: 50 },
        { toothNumber: 13, x: 300, y: 50, width: 40, height: 50 },
        { toothNumber: 14, x: 350, y: 50, width: 40, height: 50 },
        { toothNumber: 15, x: 400, y: 50, width: 40, height: 50 },
        { toothNumber: 16, x: 450, y: 50, width: 40, height: 50 },
        { toothNumber: 17, x: 500, y: 50, width: 40, height: 50 },
        { toothNumber: 18, x: 550, y: 50, width: 40, height: 50 },
        // Upper Left (21-28)
        { toothNumber: 21, x: 160, y: 50, width: 40, height: 50 },
        { toothNumber: 22, x: 120, y: 50, width: 40, height: 50 },
        { toothNumber: 23, x: 80, y: 50, width: 40, height: 50 },
        { toothNumber: 24, x: 40, y: 50, width: 40, height: 50 },
        { toothNumber: 25, x: 0, y: 50, width: 40, height: 50 },
        // Add more coordinates as needed. For now using placeholder logic.
    ];

    // Note: These coordinates need adjustment to match the PNG dimensions.
    // In WPF they were relative to the image size.
    containerWidth = 600;
    containerHeight = 400;

    constructor() {
        this.initializeHotspots();
    }

    initializeHotspots() {
        this.hotspots = [];
        // Upper Right (18-11)
        for (let i = 8; i >= 1; i--) {
            this.hotspots.push({ toothNumber: 10 + i, x: 300 + (8 - i) * 35, y: 50, width: 30, height: 45 });
        }
        // Upper Left (21-28)
        for (let i = 1; i <= 8; i++) {
            this.hotspots.push({ toothNumber: 20 + i, x: 270 - (i - 1) * 35, y: 50, width: 30, height: 45 });
        }
        // Lower Left (38-31)
        for (let i = 8; i >= 1; i--) {
            this.hotspots.push({ toothNumber: 30 + i, x: 270 - (i - 1) * 35, y: 150, width: 30, height: 45 });
        }
        // Lower Right (41-48)
        for (let i = 1; i <= 8; i++) {
            this.hotspots.push({ toothNumber: 40 + i, x: 300 + (8 - i) * 35, y: 150, width: 30, height: 45 });
        }
    }

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
