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
import { Patient } from '../../../core/models/models';
import { DataMapper } from '../../../core/utils/data-mapper';

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
    <h2 mat-dialog-title>{{ data ? 'Hasta Düzenle' : 'Yeni Hasta' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="patientForm">
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
  `]
})
export class PatientFormDialogComponent implements OnInit {
  patientForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<PatientFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Patient | null,
    private patientService: PatientService
  ) {
    this.patientForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      dateOfBirth: [null],
      gender: [''],
      phone: [''],
      email: ['', Validators.email],
      address: [''],
      city: ['']
    });
  }

  ngOnInit(): void {
    if (this.data) {
      this.patientForm.patchValue({
        firstName: this.data.firstName,
        lastName: this.data.lastName,
        dateOfBirth: this.data.dateOfBirth ? new Date(this.data.dateOfBirth) : null,
        gender: this.data.gender,
        phone: this.data.phone,
        email: this.data.email,
        address: this.data.address,
        city: this.data.city
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
        dateOfBirth: formValue.dateOfBirth ? formValue.dateOfBirth.toISOString().split('T')[0] : null,
        gender: formValue.gender,
        phone: formValue.phone,
        email: formValue.email,
        address: formValue.address,
        city: formValue.city
      };

      // Convert to backend format
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
