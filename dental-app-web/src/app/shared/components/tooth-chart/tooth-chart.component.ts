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
        <svg class="chart-svg" [attr.viewBox]="'0 0 ' + containerWidth + ' ' + containerHeight">
          <!-- Gum background -->
          <ellipse cx="300" cy="125" rx="270" ry="55" class="gum-upper" />
          <ellipse cx="300" cy="275" rx="270" ry="55" class="gum-lower" />
          <rect x="20" y="95" width="560" height="210" rx="12" class="mouth-bg" />

          <!-- Upper arch label -->
          <text x="300" y="30" text-anchor="middle" class="arch-label">Üst Çene</text>
          <!-- Lower arch label -->
          <text x="300" y="385" text-anchor="middle" class="arch-label">Alt Çene</text>

          <!-- Midline -->
          <line x1="300" y1="55" x2="300" y2="345" class="midline" />

          <!-- Clickable tooth hotspots -->
          <rect *ngFor="let hotspot of hotspots"
                class="hotspot"
                [class.selected]="isSelected(hotspot.toothNumber)"
                [attr.x]="hotspot.x"
                [attr.y]="hotspot.y"
                [attr.width]="hotspot.width"
                [attr.height]="hotspot.height"
                [attr.rx]="4"
                (click)="toggleTooth(hotspot.toothNumber)"
                [attr.data-tooth]="hotspot.toothNumber">
            <title>Diş {{ hotspot.toothNumber }}</title>
          </rect>

          <!-- Tooth number labels -->
          <text *ngFor="let hotspot of hotspots"
                [attr.x]="hotspot.x + hotspot.width / 2"
                [attr.y]="hotspot.y + hotspot.height / 2 + 4"
                text-anchor="middle"
                class="tooth-label"
                pointer-events="none">
            {{ hotspot.toothNumber }}
          </text>
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
      width: fit-content;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 10px;
      background: #fafbfc;
    }
    .chart-svg {
      display: block;
      max-width: 100%;
      height: auto;
      width: 600px;
    }
    .mouth-bg {
      fill: #f8fafc;
      stroke: #d1d5db;
      stroke-width: 1;
    }
    .gum-upper, .gum-lower {
      fill: #fca5a5;
      opacity: 0.35;
      stroke: #f87171;
      stroke-width: 1;
    }
    .arch-label {
      font-size: 11px;
      fill: #64748b;
      font-weight: 600;
    }
    .midline {
      stroke: #cbd5e1;
      stroke-width: 1;
      stroke-dasharray: 4 4;
    }
    .hotspot {
      fill: rgba(59, 130, 246, 0.12);
      stroke: rgba(59, 130, 246, 0.4);
      stroke-width: 1;
      cursor: pointer;
      transition: fill 0.2s, stroke 0.2s;
    }
    .hotspot:hover {
      fill: rgba(59, 130, 246, 0.3);
    }
    .hotspot.selected {
      fill: rgba(59, 130, 246, 0.65);
      stroke: #2563eb;
      stroke-width: 2;
    }
    .tooth-label {
      font-size: 9px;
      fill: #475569;
      font-weight: 600;
      user-select: none;
    }
    .hotspot.selected + .tooth-label,
    .hotspot.selected ~ .tooth-label {
      fill: #fff;
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
