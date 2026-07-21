import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PatientService } from '../../core/services/patient.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { TreatmentService } from '../../core/services/treatment.service';
import { Patient, Appointment, Treatment } from '../../core/models/models';
import { PatientFormDialogComponent } from '../../shared/components/patient-form-dialog/patient-form-dialog.component';
import { DataMapper } from '../../core/utils/data-mapper';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatListModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Hasta Yönetimi</h1>
          <p class="page-subtitle">{{ patients.length }} kayıtlı hasta</p>
        </div>
        <button mat-raised-button color="primary" (click)="openPatientForm()">
          <mat-icon>add</mat-icon>
          Yeni Hasta
        </button>
      </div>

      <div class="patients-layout">
        <!-- Sol Panel: Hasta Listesi -->
        <mat-card class="patients-list-card">
          <div class="list-toolbar">
            <mat-form-field appearance="outline" class="search-field" subscriptSizing="dynamic">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearch()" placeholder="Ad, soyad, telefon veya e-posta ile ara...">
            </mat-form-field>
          </div>

          <div *ngIf="isLoading" class="loading">
            <mat-spinner diameter="32"></mat-spinner>
          </div>

          <div *ngIf="!isLoading && patients.length === 0" class="empty-state">
            <mat-icon>badge</mat-icon>
            <div class="empty-title">Henüz hasta kaydı yok</div>
            <div class="empty-hint">"Yeni Hasta" ile ilk kaydı oluşturun.</div>
          </div>

          <table mat-table [dataSource]="patients" class="patients-table" *ngIf="!isLoading && patients.length > 0">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Ad Soyad</th>
              <td mat-cell *matCellDef="let patient" (click)="selectPatient(patient)" class="clickable-row">
                <div class="patient-avatar">{{ (patient.firstName || '?').charAt(0) }}</div>
                {{ patient.firstName }} {{ patient.lastName }}
              </td>
            </ng-container>

            <ng-container matColumnDef="phone">
              <th mat-header-cell *matHeaderCellDef>Telefon</th>
              <td mat-cell *matCellDef="let patient" (click)="selectPatient(patient)" class="clickable-row">
                {{ patient.phone || '-' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>E-posta</th>
              <td mat-cell *matCellDef="let patient" (click)="selectPatient(patient)" class="clickable-row">
                {{ patient.email || '-' }}
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"
                [class.selected]="selectedPatient?.id === row.id"></tr>
          </table>
        </mat-card>

        <!-- Sağ Panel: Hasta Detayları -->
        <mat-card class="patient-details-card" *ngIf="selectedPatient; else noSelection">
          <div class="details-header">
            <div class="patient-avatar large">{{ (selectedPatient.firstName || '?').charAt(0) }}</div>
            <div>
              <h2>{{ selectedPatient.firstName }} {{ selectedPatient.lastName }}</h2>
              <span class="page-subtitle">Hasta detayları</span>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item"><mat-icon>call</mat-icon><span>{{ selectedPatient.phone || '-' }}</span></div>
            <div class="info-item"><mat-icon>mail_outline</mat-icon><span>{{ selectedPatient.email || '-' }}</span></div>
            <div class="info-item"><mat-icon>cake</mat-icon><span>{{ formatDate(selectedPatient.dateOfBirth) }}</span></div>
            <div class="info-item"><mat-icon>wc</mat-icon><span>{{ selectedPatient.gender || '-' }}</span></div>
            <div class="info-item"><mat-icon>location_city</mat-icon><span>{{ selectedPatient.city || '-' }}</span></div>
            <div class="info-item full"><mat-icon>home</mat-icon><span>{{ selectedPatient.address || '-' }}</span></div>
          </div>

          <div class="section" *ngIf="patientAppointments.length > 0">
            <h3><mat-icon>event</mat-icon>Randevular</h3>
            <mat-list dense>
              <mat-list-item *ngFor="let apt of patientAppointments">
                {{ formatDate(apt.appointmentDate) }} · {{ apt.startTime }}
              </mat-list-item>
            </mat-list>
          </div>

          <div class="section" *ngIf="patientTreatments.length > 0">
            <h3><mat-icon>medical_information</mat-icon>Tedaviler</h3>
            <mat-list dense>
              <mat-list-item *ngFor="let treatment of patientTreatments">
                {{ treatment.treatmentType }} · {{ treatment.status }}
              </mat-list-item>
            </mat-list>
          </div>

          <div class="patient-actions">
            <button mat-stroked-button color="primary" (click)="editPatient()">
              <mat-icon>edit</mat-icon>Düzenle
            </button>
            <button mat-stroked-button color="warn" (click)="deletePatient()">
              <mat-icon>delete_outline</mat-icon>Sil
            </button>
          </div>
        </mat-card>
        <ng-template #noSelection>
          <div class="surface-card no-selection">
            <mat-icon>touch_app</mat-icon>
            <div class="empty-title">Detayları görmek için bir hasta seçin</div>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px; }
    .patients-layout {
      display: grid;
      grid-template-columns: 1.3fr 1fr;
      gap: 20px;
      align-items: start;
    }
    .patients-list-card, .patient-details-card {
      max-height: calc(100vh - 160px);
      overflow-y: auto;
      padding: 4px 0 16px;
    }
    .list-toolbar { padding: 16px 16px 8px; }
    .search-field { width: 100%; }
    .search-field mat-icon { color: var(--ink-500); margin-right: 4px; }
    .patients-table { width: 100%; }
    .patient-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--bulka-primary-100, #ccfbf1);
      color: var(--bulka-primary-700, #0f766e);
      font-weight: 700;
      font-size: 12px;
      margin-right: 10px;
      vertical-align: middle;
    }
    .patient-avatar.large {
      width: 48px;
      height: 48px;
      font-size: 18px;
      margin-right: 0;
    }
    .clickable-row {
      cursor: pointer;
    }
    .clickable-row:hover {
      background-color: var(--surface-muted);
    }
    .selected {
      background-color: var(--bulka-primary-50, #f0fdfa) !important;
    }
    .details-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px 4px;
    }
    .details-header h2 { font-size: 18px; margin: 0; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 16px 20px;
    }
    .info-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--ink-700);
    }
    .info-item.full { grid-column: 1 / -1; }
    .info-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--ink-500);
      flex-shrink: 0;
    }
    .section { padding: 4px 20px 16px; border-top: 1px solid rgba(15,23,42,0.06); margin-top: 8px; }
    .section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--ink-500);
      margin: 12px 0 4px;
      font-weight: 600;
    }
    .section h3 mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .patient-actions {
      display: flex;
      gap: 10px;
      padding: 12px 20px 4px;
    }
    .no-selection {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 48px 20px;
      color: var(--ink-500);
      text-align: center;
    }
    .no-selection mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--ink-300); }
  `]
})
export class PatientsComponent implements OnInit {
  patients: Patient[] = [];
  selectedPatient: Patient | null = null;
  patientAppointments: Appointment[] = [];
  patientTreatments: Treatment[] = [];
  displayedColumns: string[] = ['name', 'phone', 'email'];
  searchTerm = '';
  isLoading = false;

  constructor(
    private patientService: PatientService,
    private appointmentService: AppointmentService,
    private treatmentService: TreatmentService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPatients();
  }

  loadPatients(): void {
    this.isLoading = true;
    this.patientService.getPatients(1, 100, this.searchTerm).subscribe({
      next: (response) => {
        // Map backend data to frontend format
        this.patients = (response.patients || []).map((p: any) => DataMapper.mapPatient(p));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading patients:', error);
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    this.loadPatients();
  }

  selectPatient(patient: Patient): void {
    this.selectedPatient = patient;
    this.loadPatientDetails();
  }

  loadPatientDetails(): void {
    if (!this.selectedPatient) return;

    // Load appointments
    this.appointmentService.getAppointments(1, 100, this.selectedPatient.id).subscribe({
      next: (response) => {
        this.patientAppointments = (response.appointments || []).map((a: any) => DataMapper.mapAppointment(a));
      }
    });

    // Load treatments
    this.treatmentService.getTreatments(1, 100, this.selectedPatient.id).subscribe({
      next: (response) => {
        this.patientTreatments = (response.treatments || []).map((t: any) => DataMapper.mapTreatment(t));
      }
    });
  }

  openPatientForm(): void {
    const dialogRef = this.dialog.open(PatientFormDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPatients();
      }
    });
  }

  editPatient(): void {
    if (!this.selectedPatient) return;
    
    const dialogRef = this.dialog.open(PatientFormDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: this.selectedPatient
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPatients();
        // Reload selected patient details
        if (this.selectedPatient) {
          this.selectPatient(this.selectedPatient);
        }
      }
    });
  }

  deletePatient(): void {
    if (!this.selectedPatient) return;
    if (confirm('Bu hastayı silmek istediğinizden emin misiniz?')) {
      this.patientService.deletePatient(this.selectedPatient.id).subscribe({
        next: () => {
          this.loadPatients();
          this.selectedPatient = null;
        }
      });
    }
  }

  formatDate(date?: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('tr-TR');
  }
}
