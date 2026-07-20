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

    /**
     * FDI numaralandırma sistemi hotspot koordinatları.
     * mouth_chart.png'nin doğal boyutlarına (1024x482) göre piksel cinsinden ölçüldü;
     * SVG viewBox aynı boyutta olduğundan görüntü hangi boyutta çizilirse çizilsin ölçeklenir.
     * Üst sıra soldan sağa: 18..11 | 21..28 — Alt sıra soldan sağa: 38..31 | 41..48
     */
    hotspots: ToothHotspot[] = [
        // Üst çene (y: 95, yükseklik: 135)
        { toothNumber: 18, x: 86, y: 95, width: 52, height: 135 },
        { toothNumber: 17, x: 141, y: 95, width: 54, height: 135 },
        { toothNumber: 16, x: 200, y: 95, width: 56, height: 135 },
        { toothNumber: 15, x: 257, y: 95, width: 48, height: 135 },
        { toothNumber: 14, x: 306, y: 95, width: 48, height: 135 },
        { toothNumber: 13, x: 355, y: 95, width: 48, height: 135 },
        { toothNumber: 12, x: 405, y: 95, width: 50, height: 135 },
        { toothNumber: 11, x: 457, y: 95, width: 52, height: 135 },
        { toothNumber: 21, x: 517, y: 95, width: 52, height: 135 },
        { toothNumber: 22, x: 569, y: 95, width: 50, height: 135 },
        { toothNumber: 23, x: 621, y: 95, width: 48, height: 135 },
        { toothNumber: 24, x: 669, y: 95, width: 48, height: 135 },
        { toothNumber: 25, x: 717, y: 95, width: 48, height: 135 },
        { toothNumber: 26, x: 768, y: 95, width: 56, height: 135 },
        { toothNumber: 27, x: 829, y: 95, width: 54, height: 135 },
        { toothNumber: 28, x: 884, y: 95, width: 52, height: 135 },
        // Alt çene (y: 252, yükseklik: 170)
        { toothNumber: 38, x: 96, y: 252, width: 62, height: 170 },
        { toothNumber: 37, x: 160, y: 252, width: 64, height: 170 },
        { toothNumber: 36, x: 231, y: 252, width: 66, height: 170 },
        { toothNumber: 35, x: 297, y: 252, width: 50, height: 170 },
        { toothNumber: 34, x: 349, y: 252, width: 46, height: 170 },
        { toothNumber: 33, x: 396, y: 252, width: 40, height: 170 },
        { toothNumber: 32, x: 440, y: 252, width: 36, height: 170 },
        { toothNumber: 31, x: 475, y: 252, width: 34, height: 170 },
        { toothNumber: 41, x: 520, y: 252, width: 34, height: 170 },
        { toothNumber: 42, x: 553, y: 252, width: 34, height: 170 },
        { toothNumber: 43, x: 589, y: 252, width: 38, height: 170 },
        { toothNumber: 44, x: 630, y: 252, width: 44, height: 170 },
        { toothNumber: 45, x: 677, y: 252, width: 46, height: 170 },
        { toothNumber: 46, x: 729, y: 252, width: 62, height: 170 },
        { toothNumber: 47, x: 801, y: 252, width: 62, height: 170 },
        { toothNumber: 48, x: 867, y: 252, width: 60, height: 170 },
    ];

    // mouth_chart.png doğal boyutları (viewBox bu boyutlarla eşleşir)
    containerWidth = 1024;
    containerHeight = 482;

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
