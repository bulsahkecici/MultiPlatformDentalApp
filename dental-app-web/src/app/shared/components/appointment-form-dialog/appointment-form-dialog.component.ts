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
import { AppointmentService } from '../../../core/services/appointment.service';
import { PatientService } from '../../../core/services/patient.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { Appointment, Patient, User } from '../../../core/models/models';
import { DataMapper } from '../../../core/utils/data-mapper';

interface DentistOption {
  id: number;
  label: string;
}

@Component({
  selector: 'app-appointment-form-dialog',
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
    <h2 mat-dialog-title>{{ data ? 'Randevu Düzenle' : 'Yeni Randevu' }}</h2>
    <mat-dialog-content>
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
          <mat-label>Diş Hekimi</mat-label>
          <mat-select formControlName="dentistId" required>
            <mat-option *ngFor="let dentist of dentists" [value]="dentist.id">
              {{ dentist.label }}
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
            <mat-option value="Muayene">Muayene</mat-option>
            <mat-option value="Kontrol">Kontrol</mat-option>
            <mat-option value="Temizlik">Temizlik</mat-option>
            <mat-option value="Dolgu">Dolgu</mat-option>
            <mat-option value="Cekim">Cekim</mat-option>
            <mat-option value="Kanal Tedavisi">Kanal Tedavisi</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Durum</mat-label>
          <mat-select formControlName="status">
            <mat-option value="scheduled">Planlandi</mat-option>
            <mat-option value="completed">Tamamlandi</mat-option>
            <mat-option value="cancelled">Iptal Edildi</mat-option>
            <mat-option value="no_show">Gelmedi</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notlar</mat-label>
          <textarea matInput formControlName="notes" rows="3"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions>
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
  `]
})
export class AppointmentFormDialogComponent implements OnInit {
  appointmentForm: FormGroup;
  patients: Patient[] = [];
  dentists: DentistOption[] = [];
  isLoading = false;
  private currentUser: User | null = null;
  private isDentist = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AppointmentFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Appointment | null,
    private appointmentService: AppointmentService,
    private patientService: PatientService,
    private userService: UserService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.currentUser = this.authService.currentUser;
    this.isDentist = !!this.currentUser?.roles?.includes('dentist');
    this.appointmentForm = this.fb.group({
      patientId: ['', Validators.required],
      dentistId: ['', Validators.required],
      appointmentDate: [new Date(), Validators.required],
      startTime: ['09:00', Validators.required],
      endTime: ['10:00', Validators.required],
      appointmentType: [''],
      status: ['scheduled'],
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
        dentistId: mapped.dentistId || mapped.dentist_id || '',
        appointmentDate: date,
        startTime: startTime.substring(0, 5),
        endTime: endTime.substring(0, 5),
        appointmentType: mapped.appointmentType || mapped.appointment_type,
        status: mapped.status || 'scheduled',
        notes: mapped.notes
      });
    }
  }

  private userLabel(user: User): string {
    const first = user.firstName || user.first_name || '';
    const last = user.lastName || user.last_name || '';
    const fullName = `${first} ${last}`.trim();
    return fullName ? `Dr. ${fullName}` : user.email;
  }

  loadPatients(): void {
    this.patientService.getPatients(1, 1000).subscribe({
      next: (response) => {
        this.patients = response.patients || [];
      }
    });
  }

  loadDentists(): void {
    if (this.isDentist && this.currentUser?.id) {
      this.userService.getUser(this.currentUser.id).subscribe({
        next: (response) => {
          const user = response.user;
          this.dentists = [{ id: user.id, label: this.userLabel(user) }];
          this.appointmentForm.patchValue({ dentistId: user.id });
          this.appointmentForm.get('dentistId')?.disable();
        },
        error: () => {
          if (this.currentUser) {
            this.dentists = [{ id: this.currentUser.id, label: this.userLabel(this.currentUser) }];
            this.appointmentForm.patchValue({ dentistId: this.currentUser.id });
            this.appointmentForm.get('dentistId')?.disable();
          }
        }
      });
      return;
    }

    this.userService.getUsers(500, 'dentist').subscribe({
      next: (response) => {
        const users = response.users || [];
        this.dentists = users
          .filter(u => (u.roles || []).includes('dentist'))
          .map(u => ({ id: u.id, label: this.userLabel(u) }));

        if (this.dentists.length > 0 && !this.appointmentForm.value.dentistId) {
          this.appointmentForm.patchValue({ dentistId: this.dentists[0].id });
        }
      }
    });
  }

  onSave(): void {
    if (this.appointmentForm.valid) {
      this.isLoading = true;
      const formValue = this.appointmentForm.value;
      const appointmentData: Partial<Appointment> = {
        patientId: formValue.patientId,
        dentistId: this.isDentist && this.currentUser?.id ? this.currentUser.id : formValue.dentistId,
        appointmentDate: formValue.appointmentDate.toISOString().split('T')[0],
        startTime: `${formValue.startTime}:00`,
        endTime: `${formValue.endTime}:00`,
        appointmentType: formValue.appointmentType,
        status: formValue.status || 'scheduled',
        notes: formValue.notes,
      };

      // Convert to backend format
      const backendData = DataMapper.mapAppointmentToBackend(appointmentData);

      const request = this.data
        ? this.appointmentService.updateAppointment(this.data.id, backendData)
        : this.appointmentService.createAppointment(backendData);

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

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
