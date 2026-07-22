import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PatientService } from '../../../core/services/patient.service';
import { Patient } from '../../../core/models/models';
import { DateUtils } from '../../../core/utils/date-utils';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-patient-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Hasta Düzenle' : 'Yeni Hasta' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="patientForm">
        <mat-form-field appearance="outline" class="full-width" *ngIf="data?.protocolNumber">
          <mat-label>Protokol Numarası</mat-label>
          <input matInput [value]="data?.protocolNumber" readonly>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Kimlik Türü</mat-label>
            <mat-select formControlName="identityType">
              <mat-option value="tc">T.C. Kimlik</mat-option>
              <mat-option value="ykn">Yabancı Kimlik</mat-option>
              <mat-option value="passport">Pasaport</mat-option>
              <mat-option value="other">Diğer</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Kimlik Numarası</mat-label>
            <input matInput formControlName="identityNumber">
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Ad</mat-label>
            <input matInput formControlName="firstName" required>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Soyad</mat-label>
            <input matInput formControlName="lastName" required>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Doğum Tarihi</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="dateOfBirth">
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Cinsiyet</mat-label>
            <mat-select formControlName="gender">
              <mat-option value="male">Erkek</mat-option>
              <mat-option value="female">Kadın</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Telefon</mat-label>
          <input matInput formControlName="phone">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>E-posta</mat-label>
          <input matInput type="email" formControlName="email">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Adres</mat-label>
          <textarea matInput formControlName="address" rows="2"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Şehir</mat-label>
          <input matInput formControlName="city">
        </mat-form-field>

        <section class="clinical-section" *ngIf="canEditClinical">
          <h3>Klinik anamnez</h3>
          <mat-form-field appearance="outline" class="full-width critical-field">
            <mat-label>Kritik Uyarılar</mat-label>
            <textarea matInput formControlName="criticalAlerts" rows="2"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Kan Grubu</mat-label>
            <input matInput formControlName="bloodType">
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Alerjiler</mat-label>
            <textarea matInput formControlName="allergies" rows="2"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tıbbi Durumlar</mat-label>
            <textarea matInput formControlName="medicalConditions" rows="2"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Mevcut İlaçlar</mat-label>
            <textarea matInput formControlName="currentMedications" rows="2"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Klinik Notlar</mat-label>
            <textarea matInput formControlName="notes" rows="2"></textarea>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full-width" *ngIf="data && clinicalFieldsDirty">
            <mat-label>Anamnez Değişiklik Gerekçesi</mat-label>
            <textarea matInput formControlName="anamnesisReason" rows="2" required></textarea>
          </mat-form-field>
        </section>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button (click)="onCancel()">İptal</button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!patientForm.valid || isLoading">
        <mat-spinner *ngIf="isLoading" diameter="20" class="inline-spinner"></mat-spinner>
        <span *ngIf="!isLoading">Kaydet</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    mat-dialog-content {
      min-width: 500px;
      max-height: 600px;
      overflow-y: auto;
    }
    .clinical-section { border-top: 1px solid #d1d5db; padding-top: 12px; }
    .clinical-section h3 { color: #134e4a; }
    .critical-field { --mdc-outlined-text-field-outline-color: #dc2626; }
  `]
})
export class PatientFormDialogComponent implements OnInit {
  patientForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<PatientFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Patient | null,
    private patientService: PatientService,
    private snackBar: MatSnackBar,
    private authService: AuthService
  ) {
    this.patientForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      identityType: [''],
      identityNumber: [''],
      dateOfBirth: [null],
      gender: [''],
      phone: [''],
      email: ['', Validators.email],
      address: [''],
      city: [''],
      bloodType: [''],
      allergies: [''],
      medicalConditions: [''],
      currentMedications: [''],
      criticalAlerts: [''],
      notes: [''],
      anamnesisReason: ['']
    });
  }

  ngOnInit(): void {
    if (this.data) {
      this.patientForm.patchValue({
        firstName: this.data.firstName,
        lastName: this.data.lastName,
        identityType: this.data.identityType,
        identityNumber: this.data.identityNumber,
        dateOfBirth: this.data.dateOfBirth ? new Date(this.data.dateOfBirth) : null,
        gender: this.data.gender,
        phone: this.data.phone,
        email: this.data.email,
        address: this.data.address,
        city: this.data.city,
        bloodType: this.data.bloodType,
        allergies: this.data.allergies,
        medicalConditions: this.data.medicalConditions,
        currentMedications: this.data.currentMedications,
        criticalAlerts: this.data.criticalAlerts,
        notes: this.data.notes
      });
    }
  }

  get canEditClinical(): boolean {
    return this.authService.currentUser?.roles?.includes('dentist') ?? false;
  }

  get clinicalFieldsDirty(): boolean {
    return ['bloodType', 'allergies', 'medicalConditions', 'currentMedications', 'criticalAlerts', 'notes']
      .some(name => this.patientForm.get(name)?.dirty);
  }

  onSave(): void {
    if (this.patientForm.valid) {
      this.isLoading = true;
      const formValue = this.patientForm.value;
      const patientData: Partial<Patient> = {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        identityType: formValue.identityType || undefined,
        identityNumber: formValue.identityNumber || undefined,
        dateOfBirth: formValue.dateOfBirth ? DateUtils.toLocalDateString(formValue.dateOfBirth) : undefined,
        gender: formValue.gender,
        phone: formValue.phone,
        email: formValue.email,
        address: formValue.address,
        city: formValue.city
      };

      if (this.canEditClinical && (!this.data || this.clinicalFieldsDirty)) {
        Object.assign(patientData, {
          bloodType: formValue.bloodType,
          allergies: formValue.allergies,
          medicalConditions: formValue.medicalConditions,
          currentMedications: formValue.currentMedications,
          criticalAlerts: formValue.criticalAlerts,
          notes: formValue.notes,
          ...(this.data ? { anamnesisReason: formValue.anamnesisReason } : {})
        });
      }

      if (this.data && this.clinicalFieldsDirty && !formValue.anamnesisReason?.trim()) {
        this.snackBar.open('Anamnez değişiklik gerekçesi zorunludur', 'Kapat', { duration: 5000 });
        this.isLoading = false;
        return;
      }

      const request = this.data
        ? this.patientService.updatePatient(this.data.id, patientData)
        : this.patientService.createPatient(patientData);

      request.subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error) => {
          console.error('Error saving patient:', error);
          const errorMessage = error.error?.message || 'Hasta kaydedilirken hata oluştu';
          this.snackBar.open(errorMessage, 'Kapat', { duration: 5000 });
          this.isLoading = false;
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
