import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DashboardService, DentistEarnings } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-dentist-earnings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="earnings-container">
      <h1>Kazançlarım</h1>

      <div *ngIf="isLoading" class="loading">
        <mat-spinner></mat-spinner>
      </div>

      <div *ngIf="!isLoading" class="earnings-grid">
        <mat-card *ngFor="let earning of earnings" class="earning-card">
          <mat-card-content>
            <div class="earning-label">{{ earning.label }}</div>
            <div class="earning-value">{{ formatCurrency(earning.amount) }}</div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .earnings-container {
      padding: 20px;
    }
    .earnings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .earning-card {
      text-align: center;
    }
    .earning-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }
    .earning-value {
      font-size: 20px;
      font-weight: bold;
      color: var(--bulka-primary-600, #0d9488);
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 400px;
    }
  `]
})
export class DentistEarningsComponent implements OnInit {
  earnings: any[] = [];
  isLoading = false;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadEarnings();
  }

  loadEarnings(): void {
    this.isLoading = true;
    this.dashboardService.getDentistEarnings().subscribe({
      next: (data) => {
        this.earnings = [
          { label: 'Toplam Ciro', amount: data.earnings.totalTurnover || 0 },
          { label: 'Ödenen Komisyon', amount: data.earnings.paidTurnoverShare || 0 },
          { label: 'Toplam Kazanç', amount: data.earnings.totalEarnings || 0 },
          { label: 'Maaş', amount: data.earnings.salary || 0 }
        ];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading earnings:', error);
        this.earnings = [];
        this.isLoading = false;
      }
    });
  }

  formatCurrency(amount: number): string {
    return `₺${amount.toLocaleString('tr-TR')}`;
  }
}
