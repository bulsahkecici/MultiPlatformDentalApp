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
    <div class="patients-container">
      <div class="patients-header">
        <h1>Hasta Yönetimi</h1>
        <button mat-raised-button color="primary" (click)="openPatientForm()">
          <mat-icon>add</mat-icon>
          Yeni Hasta
        </button>
      </div>

      <div class="patients-layout">
        <!-- Sol Panel: Hasta Listesi -->
        <mat-card class="patients-list-card">
          <mat-card-header>
            <mat-card-title>Hastalar</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Ara</mat-label>
              <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearch()" placeholder="Hasta ara...">
              <mat-icon matPrefix>search</mat-icon>
            </mat-form-field>

            <div *ngIf="isLoading" class="loading">
              <mat-spinner></mat-spinner>
            </div>

            <table mat-table [dataSource]="patients" class="patients-table" *ngIf="!isLoading">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Ad Soyad</th>
                <td mat-cell *matCellDef="let patient" (click)="selectPatient(patient)" class="clickable-row">
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
          </mat-card-content>
        </mat-card>

        <!-- Sağ Panel: Hasta Detayları -->
        <mat-card class="patient-details-card" *ngIf="selectedPatient">
          <mat-card-header>
            <mat-card-title>{{ selectedPatient.firstName }} {{ selectedPatient.lastName }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="patient-info">
              <p><strong>Telefon:</strong> {{ selectedPatient.phone || '-' }}</p>
              <p><strong>E-posta:</strong> {{ selectedPatient.email || '-' }}</p>
              <p><strong>Doğum Tarihi:</strong> {{ formatDate(selectedPatient.dateOfBirth) }}</p>
              <p><strong>Cinsiyet:</strong> {{ selectedPatient.gender || '-' }}</p>
              <p><strong>Adres:</strong> {{ selectedPatient.address || '-' }}</p>
              <p><strong>Şehir:</strong> {{ selectedPatient.city || '-' }}</p>
            </div>

            <div class="patient-appointments" *ngIf="patientAppointments.length > 0">
              <h3>Randevular</h3>
              <mat-list>
                <mat-list-item *ngFor="let apt of patientAppointments">
                  {{ formatDate(apt.appointmentDate) }} - {{ apt.startTime }}
                </mat-list-item>
              </mat-list>
            </div>

            <div class="patient-treatments" *ngIf="patientTreatments.length > 0">
              <h3>Tedaviler</h3>
              <mat-list>
                <mat-list-item *ngFor="let treatment of patientTreatments">
                  {{ treatment.treatmentType }} - {{ treatment.status }}
                </mat-list-item>
              </mat-list>
            </div>

            <div class="patient-actions">
              <button mat-raised-button color="primary" (click)="editPatient()">Düzenle</button>
              <button mat-raised-button color="warn" (click)="deletePatient()">Sil</button>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .patients-container {
      padding: 20px;
    }
    .patients-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .patients-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .patients-list-card, .patient-details-card {
      height: calc(100vh - 200px);
      overflow-y: auto;
    }
    .search-field {
      width: 100%;
      margin-bottom: 16px;
    }
    .patients-table {
      width: 100%;
    }
    .clickable-row {
      cursor: pointer;
    }
    .clickable-row:hover {
      background-color: #f5f5f5;
    }
    .selected {
      background-color: #E6F2FF !important;
    }
    .patient-info p {
      margin: 8px 0;
    }
    .patient-actions {
      margin-top: 20px;
      display: flex;
      gap: 10px;
    }
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
