import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { ActivatedRoute } from '@angular/router';
import { TreatmentService } from '../../core/services/treatment.service';
import { AuthService } from '../../core/services/auth.service';
import { PatientService } from '../../core/services/patient.service';
import { Patient, Treatment } from '../../core/models/models';
import { TreatmentFormDialogComponent, TreatmentFormDialogData } from '../../shared/components/treatment-form-dialog/treatment-form-dialog.component';
import { DataMapper } from '../../core/utils/data-mapper';

interface PatientTreatmentGroup {
  patientId: number;
  patientName: string;
  treatments: Treatment[];
}

@Component({
  selector: 'app-treatments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatExpansionModule
  ],
  template: `
    <div class="treatments-container">
      <div class="treatments-header">
        <h1>Tedavi Yonetimi</h1>
        <button mat-raised-button color="primary" (click)="openTreatmentForm()">
          <mat-icon>add</mat-icon>
          Yeni Tedavi
        </button>
      </div>

      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-grid">
            <mat-form-field appearance="outline">
              <mat-label>Hasta</mat-label>
              <mat-select [(ngModel)]="selectedPatientId" (selectionChange)="loadTreatments()">
                <mat-option [value]="null">Tum Hastalar</mat-option>
                <mat-option *ngFor="let p of patients" [value]="p.id">
                  {{ p.firstName || p.first_name }} {{ p.lastName || p.last_name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Baslangic Tarihi</mat-label>
              <input matInput type="date" [(ngModel)]="startDate" (change)="loadTreatments()">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Bitis Tarihi</mat-label>
              <input matInput type="date" [(ngModel)]="endDate" (change)="loadTreatments()">
            </mat-form-field>

            <button mat-stroked-button (click)="clearFilters()">
              <mat-icon>filter_alt_off</mat-icon>
              Filtreleri Temizle
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <div *ngIf="isLoading" class="loading">
        <mat-spinner></mat-spinner>
      </div>

      <mat-accordion *ngIf="!isLoading">
        <mat-expansion-panel *ngFor="let group of patientGroups" [expanded]="selectedPatientId === group.patientId">
          <mat-expansion-panel-header>
            <mat-panel-title>
              {{ group.patientName }}
            </mat-panel-title>
            <mat-panel-description>
              {{ group.treatments.length }} islem
            </mat-panel-description>
          </mat-expansion-panel-header>

          <table mat-table [dataSource]="group.treatments" class="treatments-table">
            <ng-container matColumnDef="treatmentDate">
              <th mat-header-cell *matHeaderCellDef>Tarih</th>
              <td mat-cell *matCellDef="let treatment">{{ formatDate(treatment.treatmentDate || treatment.treatment_date) }}</td>
            </ng-container>

            <ng-container matColumnDef="tooth">
              <th mat-header-cell *matHeaderCellDef>Dis</th>
              <td mat-cell *matCellDef="let treatment">{{ treatment.toothNumber || treatment.tooth_number || '-' }}</td>
            </ng-container>

            <ng-container matColumnDef="treatmentType">
              <th mat-header-cell *matHeaderCellDef>Islem</th>
              <td mat-cell *matCellDef="let treatment">{{ treatment.treatmentType || treatment.treatment_type }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Durum</th>
              <td mat-cell *matCellDef="let treatment">{{ statusLabel(treatment.status) }}</td>
            </ng-container>

            <ng-container matColumnDef="cost" *ngIf="canViewPrices">
              <th mat-header-cell *matHeaderCellDef>Ucret</th>
              <td mat-cell *matCellDef="let treatment">{{ formatCurrency(treatment.cost) }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef>Islemler</th>
              <td mat-cell *matCellDef="let treatment">
                <button mat-icon-button (click)="editTreatment(treatment)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="deleteTreatment(treatment)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          </table>
        </mat-expansion-panel>
      </mat-accordion>

      <mat-card *ngIf="!isLoading && patientGroups.length === 0">
        <mat-card-content>Gosterilecek tedavi bulunamadi.</mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .treatments-container { padding: 20px; }
    .treatments-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .filters-card { margin-bottom: 12px; }
    .filters-grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 12px; align-items: center; }
    .treatments-table { width: 100%; }
    .loading { display: flex; justify-content: center; align-items: center; height: 240px; }
  `]
})
export class TreatmentsComponent implements OnInit {
  treatments: Treatment[] = [];
  patientGroups: PatientTreatmentGroup[] = [];
  patients: Patient[] = [];
  displayedColumns: string[] = ['treatmentDate', 'tooth', 'treatmentType', 'status', 'cost', 'actions'];
  isLoading = false;
  canViewPrices = false;

  selectedPatientId: number | null = null;
  startDate = '';
  endDate = '';
  private formOpenedFromQuery = false;

  constructor(
    private treatmentService: TreatmentService,
    private authService: AuthService,
    private patientService: PatientService,
    private route: ActivatedRoute,
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
    this.loadPatients();

    this.route.queryParamMap.subscribe(params => {
      const patientIdParam = params.get('patientId');
      const appointmentIdParam = params.get('appointmentId');
      this.selectedPatientId = patientIdParam ? Number(patientIdParam) : null;
      this.loadTreatments();

      if ((patientIdParam || appointmentIdParam) && !this.formOpenedFromQuery) {
        this.formOpenedFromQuery = true;
        this.openTreatmentForm(
          patientIdParam ? Number(patientIdParam) : undefined,
          appointmentIdParam ? Number(appointmentIdParam) : undefined
        );
      }
    });
  }

  loadPatients(): void {
    this.patientService.getPatients(1, 1000).subscribe({
      next: (response) => {
        this.patients = (response.patients || []).map((p: any) => DataMapper.mapPatient(p));
      }
    });
  }

  loadTreatments(): void {
    this.isLoading = true;

    this.treatmentService.getTreatments(
      1,
      1000,
      this.selectedPatientId || undefined,
      this.startDate || undefined,
      this.endDate || undefined
    ).subscribe({
      next: (response) => {
        this.treatments = (response.treatments || []).map(t => DataMapper.mapTreatment(t));
        this.groupTreatmentsByPatient();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading treatments:', error);
        this.treatments = [];
        this.patientGroups = [];
        this.isLoading = false;
      }
    });
  }

  groupTreatmentsByPatient(): void {
    const grouped = new Map<number, PatientTreatmentGroup>();

    for (const treatment of this.treatments) {
      const patientId = treatment.patientId || treatment.patient_id || 0;
      const patientName = `${treatment.patientFirstName || treatment.patient_first_name || ''} ${treatment.patientLastName || treatment.patient_last_name || ''}`.trim() || `Hasta #${patientId}`;

      if (!grouped.has(patientId)) {
        grouped.set(patientId, { patientId, patientName, treatments: [] });
      }
      grouped.get(patientId)!.treatments.push(treatment);
    }

    this.patientGroups = Array.from(grouped.values())
      .map(group => ({
        ...group,
        treatments: [...group.treatments].sort((a, b) => {
          const aDate = new Date(a.treatmentDate || a.treatment_date || '').getTime();
          const bDate = new Date(b.treatmentDate || b.treatment_date || '').getTime();
          return bDate - aDate;
        })
      }))
      .sort((a, b) => a.patientName.localeCompare(b.patientName, 'tr'));
  }

  clearFilters(): void {
    this.selectedPatientId = null;
    this.startDate = '';
    this.endDate = '';
    this.loadTreatments();
  }

  openTreatmentForm(patientId?: number, appointmentId?: number): void {
    const dialogData: TreatmentFormDialogData = {
      treatment: null,
      patientId,
      appointmentId
    };

    const dialogRef = this.dialog.open(TreatmentFormDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadTreatments();
    });
  }

  editTreatment(treatment: Treatment): void {
    this.treatmentService.getTreatment(treatment.id).subscribe({
      next: (response) => {
        const dialogRef = this.dialog.open(TreatmentFormDialogComponent, {
          width: '900px',
          maxWidth: '95vw',
          data: { treatment: response.treatment }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result) this.loadTreatments();
        });
      }
    });
  }

  deleteTreatment(treatment: Treatment): void {
    if (!confirm('Bu tedavi silinsin mi?')) return;

    this.treatmentService.deleteTreatment(treatment.id).subscribe({
      next: () => this.loadTreatments(),
      error: (error) => console.error('Error deleting treatment:', error)
    });
  }

  formatCurrency(amount?: number): string {
    if (!amount) return '₺0';
    return `₺${amount.toLocaleString('tr-TR')}`;
  }

  formatDate(date?: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('tr-TR');
  }

  statusLabel(status?: string): string {
    if (status === 'planned') return 'Planlandi';
    if (status === 'in_progress') return 'Devam Ediyor';
    if (status === 'completed') return 'Tamamlandi';
    if (status === 'cancelled') return 'Iptal Edildi';
    return status || '-';
  }
}
