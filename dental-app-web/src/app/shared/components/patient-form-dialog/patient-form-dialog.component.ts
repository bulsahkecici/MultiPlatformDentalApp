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
import { PatientService } from '../../../core/services/patient.service';
import { InstitutionAgreementService, InstitutionAgreement } from '../../../core/services/institution-agreement.service';
import { Patient } from '../../../core/models/models';
import { DataMapper } from '../../../core/utils/data-mapper';
import { formatLocalDate } from '../../../core/utils/date.util';

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
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">{{ data ? 'Hasta Duzenle' : 'Yeni Hasta' }}</h2>
    <p class="dialog-subtitle">Kimlik, iletisim ve temel demografik bilgileri duzenleyin.</p>
    <mat-dialog-content class="dialog-content">
      <form [formGroup]="patientForm" class="form-grid">
        <div class="form-row full-width">
          <mat-form-field appearance="outline">
            <mat-label>Ad</mat-label>
            <input matInput formControlName="firstName" required>
          </mat-form-field>
          <mat-form-field appearance="outline">
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
          <mat-label>Anlaşmalı Kurum</mat-label>
          <mat-select formControlName="institutionAgreementId">
            <mat-option [value]="null">Kurum seçilmedi</mat-option>
            <mat-option *ngFor="let agreement of agreements" [value]="agreement.id">
              {{ agreement.institution_name }} ({{ agreement.discount_percentage }}%)
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Şehir</mat-label>
          <input matInput formControlName="city">
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button (click)="onCancel()">Iptal</button>
      <button mat-raised-button color="primary" class="save-btn" (click)="onSave()" [disabled]="!patientForm.valid || isLoading">
        <mat-spinner *ngIf="isLoading" diameter="20" class="inline-spinner"></mat-spinner>
        <span *ngIf="!isLoading">Kaydet</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      margin-bottom: 2px;
    }
    .dialog-subtitle {
      margin: 0 24px 10px;
      color: #5a6986;
      font-size: 0.88rem;
    }
    .dialog-content {
      min-width: 520px;
      max-height: 66vh;
      overflow-y: auto;
      padding-top: 4px;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(180px, 1fr));
      gap: 0 14px;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .full-width {
      grid-column: span 2;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    .dialog-actions {
      border-top: 1px solid #e5edf8;
      margin-top: 10px;
      padding: 14px 24px 16px;
      gap: 10px;
    }
    .save-btn {
      min-width: 112px;
      font-weight: 700;
    }
    @media (max-width: 720px) {
      .dialog-content {
        min-width: 0;
      }
      .form-grid {
        grid-template-columns: 1fr;
      }
      .full-width {
        grid-column: span 1;
      }
      .form-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class PatientFormDialogComponent implements OnInit {
  patientForm: FormGroup;
  isLoading = false;
  agreements: InstitutionAgreement[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<PatientFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Patient | null,
    private patientService: PatientService,
    private agreementService: InstitutionAgreementService
  ) {
    this.patientForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      dateOfBirth: [null],
      gender: [''],
      phone: [''],
      email: ['', Validators.email],
      address: [''],
      city: [''],
      institutionAgreementId: [null]
    });
  }

  ngOnInit(): void {
    this.agreementService.getAgreements().subscribe({
      next: agreements => this.agreements = agreements.filter(a => a.is_active !== false)
    });

    if (this.data) {
      const mapped = DataMapper.mapPatient(this.data);
      this.patientForm.patchValue({
        firstName: mapped.firstName,
        lastName: mapped.lastName,
        dateOfBirth: mapped.dateOfBirth ? new Date(mapped.dateOfBirth) : null,
        gender: mapped.gender,
        phone: mapped.phone,
        email: mapped.email,
        address: mapped.address,
        city: mapped.city,
        institutionAgreementId: mapped.institutionAgreementId || mapped.institution_agreement_id || null
      });
    }
  }

  onSave(): void {
    if (this.patientForm.valid) {
      this.isLoading = true;
      const formValue = this.patientForm.value;
      const patientData: Partial<Patient> = {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        dateOfBirth: formValue.dateOfBirth ? formatLocalDate(formValue.dateOfBirth) : undefined,
        gender: formValue.gender,
        phone: formValue.phone,
        email: formValue.email,
        address: formValue.address,
        city: formValue.city,
        institutionAgreementId: formValue.institutionAgreementId || null
      };

      // Backend formatına dönüştür
      const backendData = DataMapper.mapPatientToBackend(patientData);

      const request = this.data
        ? this.patientService.updatePatient(this.data.id, backendData)
        : this.patientService.createPatient(backendData);

      request.subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error) => {
          console.error('Error saving patient:', error);
          this.isLoading = false;
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
