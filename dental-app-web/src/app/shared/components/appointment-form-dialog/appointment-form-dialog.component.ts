import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AppointmentService } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { UserService } from '../../../core/services/user.service';
import { Appointment, Patient } from '../../../core/models/models';
import { DataMapper } from '../../../core/utils/data-mapper';
import { DateUtils } from '../../../core/utils/date-utils';

@Component({
  selector: 'app-appointment-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Randevu Düzenle' : 'Yeni Randevu' }}</h2>
    <mat-dialog-content>
      <div class="cancelled-badge" *ngIf="data?.status === 'cancelled'">
        <mat-icon>event_busy</mat-icon> Bu randevu iptal edilmiş
      </div>

      <form [formGroup]="appointmentForm">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Hasta</mat-label>
          <mat-select formControlName="patientId" required>
            <mat-option *ngFor="let patient of patients" [value]="patient.id">
              {{ patient.firstName }} {{ patient.lastName }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Dişhekimi</mat-label>
          <mat-select formControlName="dentistId" required>
            <mat-option *ngFor="let dentist of dentists" [value]="dentist.id">
              {{ dentist.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tarih</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="appointmentDate" required>
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Başlangıç Saati</mat-label>
            <input matInput type="time" formControlName="startTime" required>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Bitiş Saati</mat-label>
            <input matInput type="time" formControlName="endTime" required>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Randevu Tipi</mat-label>
          <mat-select formControlName="appointmentType">
            <mat-option value="checkup">Kontrol</mat-option>
            <mat-option value="cleaning">Temizlik</mat-option>
            <mat-option value="filling">Dolgu</mat-option>
            <mat-option value="extraction">Çekim</mat-option>
            <mat-option value="root_canal">Kanal Tedavisi</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notlar</mat-label>
          <textarea matInput formControlName="notes" rows="3"></textarea>
        </mat-form-field>
      </form>

      <div class="cancel-panel" *ngIf="showCancelPanel">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>İptal Nedeni (opsiyonel)</mat-label>
          <textarea matInput [(ngModel)]="cancelReason" rows="2"></textarea>
        </mat-form-field>
        <div class="cancel-panel-actions">
          <button mat-button (click)="showCancelPanel = false">Vazgeç</button>
          <button mat-raised-button color="warn" (click)="confirmCancelAppointment()" [disabled]="isCancelling">
            <mat-spinner *ngIf="isCancelling" diameter="18" class="inline-spinner"></mat-spinner>
            <span *ngIf="!isCancelling">İptali Onayla</span>
          </button>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-stroked-button color="warn"
              *ngIf="data?.id && data?.status !== 'cancelled' && !showCancelPanel"
              (click)="showCancelPanel = true">
        <mat-icon>event_busy</mat-icon> Randevuyu İptal Et
      </button>
      <span class="spacer"></span>
      <button mat-button (click)="onCancel()">İptal</button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!appointmentForm.valid || isLoading">
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
    .cancelled-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--warn-50, #fef2f2);
      color: var(--warn-600, #dc2626);
      padding: 8px 12px;
      border-radius: var(--radius-sm, 6px);
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .cancel-panel {
      margin-top: 8px;
      padding: 12px;
      border: 1px solid rgba(220, 38, 38, 0.2);
      border-radius: var(--radius-sm, 6px);
      background: var(--warn-50, #fef2f2);
    }
    .cancel-panel-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .spacer {
      flex: 1 1 auto;
    }
  `]
})
export class AppointmentFormDialogComponent implements OnInit {
  appointmentForm: FormGroup;
  patients: Patient[] = [];
  dentists: { id: number; name: string }[] = [];
  isLoading = false;
  showCancelPanel = false;
  cancelReason = '';
  isCancelling = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AppointmentFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Appointment | null,
    private appointmentService: AppointmentService,
    private patientService: PatientService,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {
    this.appointmentForm = this.fb.group({
      patientId: ['', Validators.required],
      dentistId: ['', Validators.required],
      appointmentDate: [new Date(), Validators.required],
      startTime: ['09:00', Validators.required],
      endTime: ['10:00', Validators.required],
      appointmentType: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    this.loadPatients();
    this.loadDentists();

    if (this.data) {
      const mapped = DataMapper.mapAppointment(this.data);
      const date = new Date(mapped.appointmentDate || mapped.appointment_date || '');
      const startTime = mapped.startTime || mapped.start_time || '';
      const endTime = mapped.endTime || mapped.end_time || '';

      this.appointmentForm.patchValue({
        patientId: mapped.patientId || mapped.patient_id,
        dentistId: mapped.dentistId || mapped.dentist_id,
        appointmentDate: date,
        startTime: startTime.substring(0, 5),
        endTime: endTime.substring(0, 5),
        appointmentType: mapped.appointmentType || mapped.appointment_type,
        notes: mapped.notes
      });
    }
  }

  loadPatients(): void {
    this.patientService.getPatients(1, 1000).subscribe({
      next: (response) => {
        this.patients = (response.patients || []).map((p: any) => DataMapper.mapPatient(p));
      }
    });
  }

  loadDentists(): void {
    this.userService.getDentists().subscribe({
      next: (response) => {
        this.dentists = (response.dentists || []).map(d => ({
          id: d.id,
          name: (`${d.firstName || ''} ${d.lastName || ''}`.trim()) || d.email
        }));
      },
      error: () => {
        this.dentists = [];
      }
    });
  }

  onSave(): void {
    if (this.appointmentForm.valid) {
      this.isLoading = true;
      const formValue = this.appointmentForm.value;
      const appointmentData: Partial<Appointment> = {
        patientId: formValue.patientId,
        dentistId: formValue.dentistId,
        appointmentDate: DateUtils.toLocalDateString(formValue.appointmentDate),
        startTime: `${formValue.startTime}:00`,
        endTime: `${formValue.endTime}:00`,
        appointmentType: formValue.appointmentType,
        notes: formValue.notes,
        status: 'scheduled'
      };

      // this.data slot tıklaması için tarih/saat/dişhekimi önyükleme amacıyla da
      // (id'siz) doldurulabilir — gerçek düzenleme olup olmadığını id varlığı belirler.
      const request = this.data?.id
        ? this.appointmentService.updateAppointment(this.data.id, appointmentData)
        : this.appointmentService.createAppointment(appointmentData);

      request.subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error) => {
          console.error('Error saving appointment:', error);
          const errorMessage = error.error?.message || 'Randevu kaydedilirken hata oluştu';
          this.snackBar.open(errorMessage, 'Kapat', { duration: 5000 });
          this.isLoading = false;
        }
      });
    }
  }

  confirmCancelAppointment(): void {
    if (!this.data?.id) return;
    this.isCancelling = true;
    this.appointmentService.cancelAppointment(this.data.id, this.cancelReason || undefined).subscribe({
      next: () => {
        this.snackBar.open('Randevu iptal edildi', 'Kapat', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (error) => {
        const errorMessage = error.error?.message || 'Randevu iptal edilirken hata oluştu';
        this.snackBar.open(errorMessage, 'Kapat', { duration: 5000 });
        this.isCancelling = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
