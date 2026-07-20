import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TreatmentService } from '../../core/services/treatment.service';
import { AuthService } from '../../core/services/auth.service';
import { Treatment } from '../../core/models/models';
import { TreatmentFormDialogComponent } from '../../shared/components/treatment-form-dialog/treatment-form-dialog.component';
import { DataMapper } from '../../core/utils/data-mapper';

@Component({
  selector: 'app-treatments',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Tedavi Yönetimi</h1>
          <p class="page-subtitle">{{ treatments.length }} tedavi kaydı</p>
        </div>
        <button mat-raised-button color="primary" (click)="openTreatmentForm()">
          <mat-icon>add</mat-icon>
          Yeni Tedavi
        </button>
      </div>

      <div *ngIf="isLoading" class="loading">
        <mat-spinner diameter="36"></mat-spinner>
      </div>

      <mat-card *ngIf="!isLoading && treatments.length === 0">
        <div class="empty-state">
          <mat-icon>medical_information</mat-icon>
          <div class="empty-title">Henüz tedavi kaydı yok</div>
          <div class="empty-hint">"Yeni Tedavi" ile ilk kaydı oluşturun.</div>
        </div>
      </mat-card>

      <mat-card *ngIf="!isLoading && treatments.length > 0" class="table-card">
        <table mat-table [dataSource]="treatments" class="treatments-table">
          <ng-container matColumnDef="patient">
            <th mat-header-cell *matHeaderCellDef>Hasta</th>
            <td mat-cell *matCellDef="let treatment">
              {{ treatment.patientFirstName || treatment.patient_first_name }} {{ treatment.patientLastName || treatment.patient_last_name }}
            </td>
          </ng-container>

          <ng-container matColumnDef="treatmentType">
            <th mat-header-cell *matHeaderCellDef>Tedavi Tipi</th>
            <td mat-cell *matCellDef="let treatment">{{ treatment.treatmentType || treatment.treatment_type }}</td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Durum</th>
            <td mat-cell *matCellDef="let treatment">
              <span class="status-chip" [class]="statusChipClass(treatment.status)">{{ statusLabel(treatment.status) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="cost" *ngIf="canViewPrices">
            <th mat-header-cell *matHeaderCellDef>Ücret</th>
            <td mat-cell *matCellDef="let treatment">
              {{ formatCurrency(treatment.cost) }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let treatment">
              <button mat-icon-button (click)="editTreatment(treatment)" matTooltip="Düzenle">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteTreatment(treatment)" matTooltip="Sil">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns" class="data-row"></tr>
        </table>
      </mat-card>
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px; }
    .table-card { padding: 0; overflow: hidden; }
    .treatments-table {
      width: 100%;
    }
    .data-row:hover {
      background-color: var(--surface-muted);
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 300px;
    }
  `]
})
export class TreatmentsComponent implements OnInit {
  treatments: Treatment[] = [];
  displayedColumns: string[] = ['patient', 'treatmentType', 'status', 'cost', 'actions'];
  isLoading = false;
  canViewPrices = false;

  constructor(
    private treatmentService: TreatmentService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.canViewPrices = user.roles.includes('admin') || user.roles.includes('secretary');
        if (!this.canViewPrices) {
          this.displayedColumns = this.displayedColumns.filter(col => col !== 'cost');
        }
      }
    });
  }

  ngOnInit(): void {
    this.loadTreatments();
  }

  loadTreatments(): void {
    this.isLoading = true;
    this.treatmentService.getTreatments(1, 100).subscribe({
      next: (response) => {
        // Map backend data to frontend format
        this.treatments = (response.treatments || []).map(t => DataMapper.mapTreatment(t));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading treatments:', error);
        this.isLoading = false;
      }
    });
  }

  openTreatmentForm(): void {
    const dialogRef = this.dialog.open(TreatmentFormDialogComponent, {
      width: '700px',
      maxWidth: '90vw',
      data: null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadTreatments();
      }
    });
  }

  editTreatment(treatment: Treatment): void {
    // Load full treatment details first
    this.treatmentService.getTreatment(treatment.id).subscribe({
      next: (response) => {
        const dialogRef = this.dialog.open(TreatmentFormDialogComponent, {
          width: '700px',
          maxWidth: '90vw',
          data: response.treatment
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.loadTreatments();
          }
        });
      },
      error: (error) => {
        console.error('Error loading treatment:', error);
      }
    });
  }

  deleteTreatment(treatment: Treatment): void {
    if (confirm('Bu tedaviyi silmek istediğinizden emin misiniz?')) {
      this.treatmentService.deleteTreatment(treatment.id).subscribe({
        next: () => {
          this.loadTreatments();
        }
      });
    }
  }

  formatCurrency(amount?: number): string {
    if (!amount) return '₺0';
    return `₺${amount.toLocaleString('tr-TR')}`;
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      planned: 'Planlandı',
      in_progress: 'Devam Ediyor',
      completed: 'Tamamlandı',
      cancelled: 'İptal Edildi'
    };
    return labels[status] || status;
  }

  statusChipClass(status: string): string {
    const classes: Record<string, string> = {
      planned: 'status-info',
      in_progress: 'status-warn',
      completed: 'status-success',
      cancelled: 'status-danger'
    };
    return classes[status] || 'status-neutral';
  }
}
