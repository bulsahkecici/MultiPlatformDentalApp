import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { DashboardService } from '../../core/services/dashboard.service';
import { formatLocalDate } from '../../core/utils/date.util';

@Component({
  selector: 'app-dentist-earnings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule
  ],
  template: `
    <div class="earnings-container">
      <h1>Kazanclarim</h1>

      <div class="filters">
        <mat-form-field appearance="outline">
          <mat-label>Baslangic</mat-label>
          <input matInput type="date" [(ngModel)]="startDate">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Bitis</mat-label>
          <input matInput type="date" [(ngModel)]="endDate">
        </mat-form-field>
        <button mat-raised-button color="primary" (click)="loadEarnings()">Yenile</button>
      </div>

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

      <mat-card *ngIf="!isLoading" class="treatments-card">
        <mat-card-header>
          <mat-card-title>Islem Dokumu</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <table mat-table [dataSource]="treatments" class="full-width-table">
            <ng-container matColumnDef="treatment_date">
              <th mat-header-cell *matHeaderCellDef>Tarih</th>
              <td mat-cell *matCellDef="let t">{{ formatDate(t.treatment_date) }}</td>
            </ng-container>
            <ng-container matColumnDef="patient">
              <th mat-header-cell *matHeaderCellDef>Hasta</th>
              <td mat-cell *matCellDef="let t">{{ t.patient_first_name }} {{ t.patient_last_name }}</td>
            </ng-container>
            <ng-container matColumnDef="treatment_type">
              <th mat-header-cell *matHeaderCellDef>Islem</th>
              <td mat-cell *matCellDef="let t">{{ t.treatment_type }}</td>
            </ng-container>
            <ng-container matColumnDef="cost">
              <th mat-header-cell *matHeaderCellDef>Tutar</th>
              <td mat-cell *matCellDef="let t">{{ formatCurrency(t.cost) }}</td>
            </ng-container>
            <ng-container matColumnDef="earnings">
              <th mat-header-cell *matHeaderCellDef>Kazanc</th>
              <td mat-cell *matCellDef="let t">{{ formatCurrency(t.earnings) }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="treatmentColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: treatmentColumns"></tr>
          </table>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .earnings-container { padding: 20px; }
    .filters { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    .earnings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-top: 20px; }
    .earning-card { text-align: center; }
    .earning-label { font-size: 14px; color: #666; margin-bottom: 8px; }
    .earning-value { font-size: 20px; font-weight: bold; color: #3B82F6; }
    .treatments-card { margin-top: 16px; }
    .full-width-table { width: 100%; }
    .loading { display: flex; justify-content: center; align-items: center; height: 240px; }
  `]
})
export class DentistEarningsComponent implements OnInit {
  earnings: any[] = [];
  treatments: any[] = [];
  treatmentColumns = ['treatment_date', 'patient', 'treatment_type', 'cost', 'earnings'];
  isLoading = false;
  startDate = '';
  endDate = '';

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    this.startDate = formatLocalDate(firstDay);
    this.endDate = formatLocalDate(now);
    this.loadEarnings();
  }

  loadEarnings(): void {
    this.isLoading = true;
    this.dashboardService.getDentistEarnings(this.startDate || undefined, this.endDate || undefined).subscribe({
      next: (data) => {
        const e = data.earnings || {};
        this.earnings = [
          { label: 'Toplam Ciro', amount: e.totalTurnover || 0 },
          { label: 'Odenen Ciro Payi', amount: e.paidTurnoverShare || 0 },
          { label: 'Toplam Kazanc', amount: e.totalEarnings || 0 },
          { label: 'Maas', amount: e.salary || 0 },
          { label: 'Komisyon Orani', amount: e.commissionRate || 0 }
        ];
        this.treatments = data.treatments || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading earnings:', error);
        this.earnings = [];
        this.treatments = [];
        this.isLoading = false;
      }
    });
  }

  formatCurrency(amount: number): string {
    return `₺${Number(amount || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`;
  }

  formatDate(date?: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('tr-TR');
  }
}
