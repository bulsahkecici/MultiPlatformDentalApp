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
    <div class="appointments-container">
      <div class="appointments-header">
        <h1>Randevu Yönetimi</h1>
        <div class="header-actions">
          <mat-form-field appearance="outline">
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

      <div *ngIf="isLoading" class="loading">
        <mat-spinner></mat-spinner>
      </div>

      <div *ngIf="!isLoading" class="scheduler-container">
        <mat-card>
          <mat-card-content>
            <div class="scheduler-grid">
              <!-- Time column -->
              <div class="time-column">
                <div class="time-header">Saat</div>
                <div *ngFor="let slot of timeSlots" class="time-slot">
                  {{ slot.time }}
                </div>
              </div>

              <!-- Dentist columns -->
              <div *ngFor="let dentist of dentists" class="dentist-column">
                <div class="dentist-header">{{ dentist.name }}</div>
                <div *ngFor="let slot of timeSlots" 
                     class="appointment-slot"
                     [class.available]="getSlotStatus(slot, dentist.id) === 'available'"
                     [class.occupied]="getSlotStatus(slot, dentist.id) === 'occupied'"
                     (click)="onSlotClick(slot, dentist.id)">
                  <div *ngIf="getSlotAppointment(slot, dentist.id) as appointment" class="slot-content">
                    <div class="patient-name">{{ appointment.patientFirstName || appointment.patient_first_name }} {{ appointment.patientLastName || appointment.patient_last_name }}</div>
                    <div class="slot-time">{{ slot.time }}</div>
                  </div>
                  <div *ngIf="getSlotStatus(slot, dentist.id) === 'available'" class="slot-content">
                    <div class="slot-time">{{ slot.time }}</div>
                  </div>
                </div>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .appointments-container {
      padding: 20px;
    }
    .appointments-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .header-actions {
      display: flex;
      gap: 16px;
      align-items: center;
    }
    .scheduler-container {
      margin-top: 20px;
    }
    .scheduler-grid {
      display: grid;
      grid-template-columns: 100px repeat(auto-fit, minmax(150px, 1fr));
      gap: 1px;
      background-color: #ddd;
    }
    .time-column, .dentist-column {
      background-color: white;
    }
    .time-header, .dentist-header {
      padding: 10px;
      background-color: #1E3A8A;
      color: white;
      font-weight: bold;
      text-align: center;
    }
    .time-slot {
      padding: 10px;
      text-align: center;
      border-bottom: 1px solid #ddd;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .appointment-slot {
      height: 60px;
      padding: 5px;
      cursor: pointer;
      border-bottom: 1px solid #ddd;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .appointment-slot.available {
      background-color: #90EE90;
    }
    .appointment-slot.occupied {
      background-color: #DC2626;
      color: white;
    }
    .appointment-slot:hover {
      opacity: 0.8;
    }
    .slot-content {
      width: 100%;
      text-align: center;
    }
    .patient-name {
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .slot-time {
      font-size: 10px;
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 400px;
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
    this.userService.getUsers().subscribe({
      next: (response) => {
        this.dentists = (response.users || [])
          .filter(u => u.roles.includes('dentist'))
          .map(u => ({ id: u.id, name: u.email }));
        if (this.dentists.length === 0) {
          this.dentists = [{ id: 0, name: 'Doktor Yok' }];
        }
      },
      error: () => {
        this.dentists = [{ id: 0, name: 'Doktor Yok' }];
      }
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
