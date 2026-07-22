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
import { AuthService } from '../../core/services/auth.service';

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

          <div class="clinical-alert" *ngIf="hasClinicalAlert(selectedPatient)">
            <mat-icon>warning</mat-icon>
            <div>
              <strong>Kritik klinik uyarı</strong>
              <div *ngIf="selectedPatient.criticalAlerts">{{ selectedPatient.criticalAlerts }}</div>
              <div *ngIf="selectedPatient.allergies"><b>Alerji:</b> {{ selectedPatient.allergies }}</div>
              <div *ngIf="selectedPatient.medicalConditions"><b>Tıbbi durum:</b> {{ selectedPatient.medicalConditions }}</div>
              <div *ngIf="selectedPatient.currentMedications"><b>İlaç:</b> {{ selectedPatient.currentMedications }}</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-item"><mat-icon>badge</mat-icon><span>{{ selectedPatient.protocolNumber || '-' }}</span></div>
            <div class="info-item"><mat-icon>fingerprint</mat-icon><span>{{ selectedPatient.identityNumber || '-' }}</span></div>
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

          <div class="section" *ngIf="canAccessClinicalRecords">
            <h3><mat-icon>folder_shared</mat-icon>Şifreli Klinik Belgeler</h3>
            <div class="document-upload">
              <select [(ngModel)]="documentCategory">
                <option value="radiograph">Röntgen / DICOM</option>
                <option value="photo">Klinik fotoğraf</option>
                <option value="consent">İmzalı onam</option>
                <option value="report">Rapor</option>
                <option value="other">Diğer</option>
              </select>
              <input [(ngModel)]="documentTitle" placeholder="Belge başlığı">
              <input #documentFile type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.dcm">
              <button mat-stroked-button (click)="uploadDocument(documentFile)">Yükle</button>
            </div>
            <mat-list dense *ngIf="patientDocuments.length">
              <mat-list-item *ngFor="let document of patientDocuments">
                <span>{{ document.title }} · {{ document.category }}</span>
                <button mat-button (click)="downloadDocument(document)">İndir</button>
                <button mat-button color="primary" *ngIf="document.category === 'consent' && canRecordConsent"
                        (click)="recordConsent(document)">Onam Kaydı Oluştur</button>
              </mat-list-item>
            </mat-list>
            <div *ngIf="patientConsents.length" class="consent-summary">
              <strong>Onamlar:</strong>
              <div *ngFor="let consent of patientConsents">
                {{ consent.procedure_name }} · v{{ consent.form_version }} · {{ consent.status }}
              </div>
            </div>
            <button mat-raised-button color="primary" (click)="exportPatientRecord()">
              <mat-icon>download</mat-icon>Hasta Dosyasını Dışa Aktar
            </button>
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
    .clinical-alert {
      display: flex;
      gap: 12px;
      margin: 16px 0;
      padding: 14px;
      border: 2px solid #dc2626;
      border-radius: 12px;
      background: #fef2f2;
      color: #991b1b;
    }
    .document-upload { display: grid; gap: 8px; margin-bottom: 12px; }
    .document-upload select, .document-upload input { padding: 9px; border: 1px solid #cbd5e1; border-radius: 8px; }
    .consent-summary { margin: 12px 0; padding: 10px; background: #ecfeff; border-radius: 8px; }
  `]
})
export class PatientsComponent implements OnInit {
  patients: Patient[] = [];
  selectedPatient: Patient | null = null;
  patientAppointments: Appointment[] = [];
  patientTreatments: Treatment[] = [];
  patientDocuments: any[] = [];
  patientConsents: any[] = [];
  documentCategory = 'radiograph';
  documentTitle = '';
  displayedColumns: string[] = ['name', 'phone', 'email'];
  searchTerm = '';
  isLoading = false;

  constructor(
    private patientService: PatientService,
    private appointmentService: AppointmentService,
    private treatmentService: TreatmentService,
    private dialog: MatDialog,
    private authService: AuthService
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
    this.patientService.getPatient(patient.id).subscribe({
      next: (response) => {
        this.selectedPatient = DataMapper.mapPatient(response.patient);
        this.loadPatientDetails();
      },
      error: (error) => console.error('Error loading patient detail:', error)
    });
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

    if (this.canAccessClinicalRecords) {
      this.patientService.getDocuments(this.selectedPatient.id).subscribe({
        next: response => this.patientDocuments = response.documents || []
      });
      this.patientService.getConsents(this.selectedPatient.id).subscribe({
        next: response => this.patientConsents = response.consents || []
      });
    }
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

  hasClinicalAlert(patient: Patient): boolean {
    return !!(
      patient.clinicalAccess &&
      (patient.criticalAlerts || patient.allergies || patient.medicalConditions || patient.currentMedications)
    );
  }

  get canAccessClinicalRecords(): boolean {
    const roles = this.authService.currentUser?.roles || [];
    return roles.includes('dentist') || roles.includes('admin');
  }

  get canRecordConsent(): boolean {
    return this.authService.currentUser?.roles?.includes('dentist') ?? false;
  }

  uploadDocument(input: HTMLInputElement): void {
    if (!this.selectedPatient || !input.files?.length) return;
    const file = input.files[0];
    const title = this.documentTitle.trim() || file.name;
    this.patientService.uploadDocument(this.selectedPatient.id, file, this.documentCategory, title)
      .subscribe({
        next: () => {
          input.value = '';
          this.documentTitle = '';
          this.loadPatientDetails();
        },
        error: error => alert(error.error?.error?.message || 'Belge yüklenemedi')
      });
  }

  downloadDocument(document: any): void {
    if (!this.selectedPatient) return;
    this.patientService.downloadDocument(this.selectedPatient.id, document.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.original_name || 'belge';
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  exportPatientRecord(): void {
    if (!this.selectedPatient) return;
    this.patientService.exportRecord(this.selectedPatient.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = `${this.selectedPatient?.protocolNumber || 'hasta-dosyasi'}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  recordConsent(document: any): void {
    if (!this.selectedPatient) return;
    const procedureName = prompt('Onam verilen işlem adı:');
    const informationText = prompt('Hastaya aktarılan bilgilendirme özeti:');
    const risks = prompt('Açıklanan risk ve komplikasyonlar:');
    const alternatives = prompt('Açıklanan alternatifler:');
    const signer = prompt('Hasta / kanuni temsilci adı soyadı:');
    if (!procedureName || !informationText || !risks || !alternatives || !signer) return;
    this.patientService.createConsent(this.selectedPatient.id, {
      signedDocumentId: document.id,
      consentType: 'procedure',
      procedureName,
      formVersion: '1.0',
      informationText,
      risks,
      alternatives,
      patientOrRepresentativeName: signer,
      signedAt: new Date().toISOString()
    }).subscribe({
      next: () => this.loadPatientDetails(),
      error: error => alert(error.error?.error?.message || 'Onam kaydı oluşturulamadı')
    });
  }
}
