import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AppointmentService } from '../../core/services/appointment.service';
import { PatientService } from '../../core/services/patient.service';
import { UserService } from '../../core/services/user.service';
import { Appointment, Patient, User } from '../../core/models/models';
import { AppointmentFormDialogComponent } from '../../shared/components/appointment-form-dialog/appointment-form-dialog.component';
import { DataMapper } from '../../core/utils/data-mapper';

interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
}

interface AppointmentSlot {
  time: string;
  dentistId: number;
  dentistName: string;
  date: Date;
  appointment?: Appointment;
  status: 'available' | 'occupied';
}

interface DentistInfo {
  id: number;
  name: string;
}

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  template: `
    <div class="page wide">
      <div class="page-header">
        <div>
          <h1>Randevu Yönetimi</h1>
          <p class="page-subtitle">{{ selectedDateLabel() }}</p>
        </div>
        <div class="header-actions">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Tarih Seç</mat-label>
            <input matInput [matDatepicker]="picker" [(ngModel)]="selectedDate" (dateChange)="onDateChange()">
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="openAppointmentForm()">
            <mat-icon>add</mat-icon>
            Randevu Ekle
          </button>
        </div>
      </div>

      <div class="legend">
        <span class="legend-item"><span class="dot available"></span>Müsait</span>
        <span class="legend-item"><span class="dot occupied"></span>Dolu</span>
      </div>

      <div *ngIf="isLoading" class="loading">
        <mat-spinner diameter="36"></mat-spinner>
      </div>

      <div *ngIf="!isLoading && dentists.length === 0" class="surface-card empty-state">
        <mat-icon>person_search</mat-icon>
        <div class="empty-title">Sistemde kayıtlı dişhekimi yok</div>
        <div class="empty-hint">Randevu oluşturabilmek için önce Kullanıcı Yönetimi'nden bir dişhekimi ekleyin.</div>
      </div>

      <div *ngIf="!isLoading && dentists.length > 0" class="scheduler-container surface-card">
        <div class="scheduler-scroll">
          <div class="scheduler-grid" [style.grid-template-columns]="'88px repeat(' + dentists.length + ', minmax(150px, 1fr))'">
            <!-- Time column -->
            <div class="time-column">
              <div class="col-header time-header">Saat</div>
              <div *ngFor="let slot of timeSlots" class="time-slot">
                {{ slot.time }}
              </div>
            </div>

            <!-- Dentist columns -->
            <div *ngFor="let dentist of dentists" class="dentist-column">
              <div class="col-header dentist-header">
                <mat-icon>person</mat-icon>
                <span>{{ dentist.name }}</span>
              </div>
              <div *ngFor="let slot of timeSlots"
                   class="appointment-slot"
                   [class.available]="getSlotStatus(slot, dentist.id) === 'available'"
                   [class.occupied]="getSlotStatus(slot, dentist.id) === 'occupied'"
                   (click)="onSlotClick(slot, dentist.id)">
                <div *ngIf="getSlotAppointment(slot, dentist.id) as appointment" class="slot-content">
                  <div class="patient-name">{{ appointment.patientFirstName || appointment.patient_first_name }} {{ appointment.patientLastName || appointment.patient_last_name }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page.wide { padding: 24px 32px; max-width: 1600px; }
    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .legend {
      display: flex;
      gap: 20px;
      margin-bottom: 12px;
      font-size: 13px;
      color: var(--ink-500);
    }
    .legend-item { display: flex; align-items: center; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .dot.available { background: var(--surface-muted); border: 1px solid var(--ink-300); }
    .dot.occupied { background: var(--bulka-primary-600, #2563eb); }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 300px;
    }
    .scheduler-container {
      overflow: hidden;
    }
    .scheduler-scroll {
      overflow-x: auto;
    }
    .scheduler-grid {
      display: grid;
      min-width: 100%;
    }
    .time-column, .dentist-column {
      background-color: var(--surface);
      border-right: 1px solid rgba(15, 23, 42, 0.06);
    }
    .col-header {
      padding: 12px 10px;
      background: var(--surface-muted);
      color: var(--ink-700);
      font-weight: 600;
      font-size: 13px;
      text-align: center;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 44px;
      box-sizing: border-box;
    }
    .dentist-header mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--bulka-primary-600, #2563eb);
    }
    .dentist-header span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .time-slot {
      padding: 6px;
      text-align: center;
      border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: var(--ink-500);
      font-variant-numeric: tabular-nums;
    }
    .appointment-slot {
      height: 44px;
      padding: 4px 6px;
      cursor: pointer;
      border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.1s ease;
    }
    .appointment-slot.available {
      background-color: var(--surface);
    }
    .appointment-slot.available:hover {
      background-color: var(--bulka-primary-50, #eff6ff);
    }
    .appointment-slot.occupied {
      background-color: var(--bulka-primary-600, #2563eb);
      color: white;
    }
    .appointment-slot.occupied:hover {
      background-color: var(--bulka-primary-700, #1d4ed8);
    }
    .slot-content {
      width: 100%;
      text-align: center;
      overflow: hidden;
    }
    .patient-name {
      font-weight: 600;
      font-size: 11.5px;
      line-height: 1.3;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `]
})
export class AppointmentsComponent implements OnInit {
  selectedDate: Date = new Date();
  timeSlots: TimeSlot[] = [];
  dentists: DentistInfo[] = [];
  appointments: Appointment[] = [];
  appointmentSlots: AppointmentSlot[] = [];
  isLoading = false;

  constructor(
    private appointmentService: AppointmentService,
    private patientService: PatientService,
    private userService: UserService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.initializeTimeSlots();
    this.loadDentists();
  }

  loadDentists(): void {
    // Tüm kimliği doğrulanmış personel erişebilir (admin gerektirmez) — bkz. src/routes/users.js
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

  selectedDateLabel(): string {
    return this.selectedDate.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  ngOnInit(): void {
    this.loadAppointments();
  }

  initializeTimeSlots(): void {
    this.timeSlots = [];
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        this.timeSlots.push({
          time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          hour,
          minute
        });
      }
    }
  }

  onDateChange(): void {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.isLoading = true;
    const dateStr = this.selectedDate.toISOString().split('T')[0];
    
    this.appointmentService.getAppointments(1, 1000, undefined, undefined, dateStr, dateStr).subscribe({
      next: (response) => {
        // Map backend data to frontend format
        this.appointments = (response.appointments || []).map((a: any) => DataMapper.mapAppointment(a));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading appointments:', error);
        this.snackBar.open('Randevular yüklenirken hata oluştu', 'Kapat', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  getSlotStatus(slot: TimeSlot, dentistId: number): 'available' | 'occupied' {
    const appointment = this.getSlotAppointment(slot, dentistId);
    return appointment ? 'occupied' : 'available';
  }

  getSlotAppointment(slot: TimeSlot, dentistId: number): Appointment | undefined {
    if (dentistId === 0) return undefined; // Skip placeholder dentist
    
    const dateStr = this.selectedDate.toISOString().split('T')[0];
    const slotTimeMinutes = slot.hour * 60 + slot.minute;
    
    return this.appointments.find(apt => {
      const aptDate = (apt.appointmentDate || apt.appointment_date || '').split('T')[0];
      if (aptDate !== dateStr) return false;
      
      const aptDentistId = apt.dentistId || apt.dentist_id;
      if (aptDentistId !== dentistId) return false;
      if (apt.status === 'cancelled' || apt.status === 'no_show') return false;
      
      // Parse appointment times
      const startTime = apt.startTime || apt.start_time || '';
      const endTime = apt.endTime || apt.end_time || '';
      const startParts = startTime.split(':');
      const endParts = endTime.split(':');
      const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
      const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
      
      // Check if slot time falls within appointment time range
      return slotTimeMinutes >= startMinutes && slotTimeMinutes < endMinutes;
    });
  }

  onSlotClick(slot: TimeSlot, dentistId: number): void {
    const appointment = this.getSlotAppointment(slot, dentistId);
    if (appointment) {
      // Edit appointment
      this.openAppointmentForm(appointment);
    } else {
      // Create new appointment
      const newAppointment: Partial<Appointment> = {
        appointmentDate: this.selectedDate.toISOString().split('T')[0],
        startTime: `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}:00`,
        endTime: `${slot.hour.toString().padStart(2, '0')}:${(slot.minute + 30).toString().padStart(2, '0')}:00`,
        dentistId: dentistId,
        status: 'scheduled'
      };
      this.openAppointmentForm(newAppointment as Appointment);
    }
  }

  openAppointmentForm(appointment?: Appointment): void {
    const dialogRef = this.dialog.open(AppointmentFormDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      data: appointment || null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadAppointments();
      }
    });
  }
}
