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
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { Appointment, User } from '../../core/models/models';
import { AppointmentFormDialogComponent } from '../../shared/components/appointment-form-dialog/appointment-form-dialog.component';
import { AppointmentDetailsDialogComponent } from '../../shared/components/appointment-details-dialog/appointment-details-dialog.component';
import { DataMapper } from '../../core/utils/data-mapper';
import { formatLocalDate } from '../../core/utils/date.util';

interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
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
        <h1>Randevu Yonetimi</h1>
        <div class="header-actions">
          <mat-form-field appearance="outline">
            <mat-label>Tarih Sec</mat-label>
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
            <div class="scheduler-grid" [style.gridTemplateColumns]="'100px repeat(' + dentists.length + ', minmax(160px, 1fr))'">
              <div class="time-column">
                <div class="time-header">Saat</div>
                <div *ngFor="let slot of timeSlots" class="time-slot">
                  {{ slot.time }}
                </div>
              </div>

              <div *ngFor="let dentist of dentists" class="dentist-column">
                <div class="dentist-header">{{ dentist.name }}</div>
                <div *ngFor="let slot of timeSlots"
                     class="appointment-slot"
                     [ngClass]="getSlotClass(slot, dentist.id)"
                     (click)="onSlotClick(slot, dentist.id)">
                  <div *ngIf="getSlotAppointment(slot, dentist.id) as appointment" class="slot-content">
                    <div class="patient-name">{{ appointment.patientFirstName || appointment.patient_first_name }} {{ appointment.patientLastName || appointment.patient_last_name }}</div>
                    <div class="slot-meta">{{ statusLabel(appointment.status) }}</div>
                  </div>
                  <div *ngIf="!getSlotAppointment(slot, dentist.id)" class="slot-content">
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
    .appointments-container { padding: 20px; }
    .appointments-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .header-actions { display: flex; gap: 16px; align-items: center; }
    .scheduler-container { margin-top: 20px; }
    .scheduler-grid { display: grid; gap: 1px; background-color: #ddd; overflow-x: auto; }
    .time-column, .dentist-column { background-color: white; min-width: 0; }
    .time-header, .dentist-header { padding: 10px; background-color: #1E3A8A; color: white; font-weight: bold; text-align: center; }
    .time-slot { padding: 6px; text-align: center; border-bottom: 1px solid #ddd; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .appointment-slot { height: 44px; padding: 4px; cursor: pointer; border-bottom: 1px solid #ddd; display: flex; align-items: center; justify-content: center; }
    .appointment-slot.available { background-color: #dcfce7; }
    .appointment-slot.occupied { background-color: #dbeafe; }
    .appointment-slot.unavailable { background-color: #fee2e2; }
    .appointment-slot:hover { opacity: 0.85; }
    .slot-content { width: 100%; text-align: center; }
    .patient-name { font-weight: 600; font-size: 11px; line-height: 1.2; }
    .slot-meta, .slot-time { font-size: 10px; color: #374151; }
    .loading { display: flex; justify-content: center; align-items: center; height: 400px; }
  `]
})
export class AppointmentsComponent implements OnInit {
  selectedDate: Date = new Date();
  timeSlots: TimeSlot[] = [];
  dentists: DentistInfo[] = [];
  appointments: Appointment[] = [];
  isLoading = false;
  private currentUser: User | null = null;
  private isDentist = false;

  constructor(
    private appointmentService: AppointmentService,
    private userService: UserService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.currentUser = this.authService.currentUser;
    this.isDentist = !!this.currentUser?.roles?.includes('dentist');
    this.initializeTimeSlots();
  }

  ngOnInit(): void {
    this.loadDentists();
    this.loadAppointments();
  }

  initializeTimeSlots(): void {
    this.timeSlots = [];
    for (let hour = 8; hour <= 21; hour++) {
      this.timeSlots.push({ time: `${hour.toString().padStart(2, '0')}:00`, hour, minute: 0 });
      if (hour < 21) {
        this.timeSlots.push({ time: `${hour.toString().padStart(2, '0')}:30`, hour, minute: 30 });
      }
    }
  }

  loadDentists(): void {
    if (this.isDentist && this.currentUser?.id) {
      this.userService.getUser(this.currentUser.id).subscribe({
        next: (response) => {
          const u = response.user;
          const first = u.firstName || u.first_name || '';
          const last = u.lastName || u.last_name || '';
          const full = `${first} ${last}`.trim();
          this.dentists = [{ id: u.id, name: full ? `Dr. ${full}` : u.email }];
        },
        error: () => {
          if (this.currentUser) {
            this.dentists = [{ id: this.currentUser.id, name: this.currentUser.email }];
          }
        }
      });
      return;
    }

    this.userService.getUsers(500, 'dentist').subscribe({
      next: (response) => {
        this.dentists = (response.users || [])
          .filter(u => (u.roles || []).includes('dentist'))
          .map(u => {
            const first = u.firstName || u.first_name || '';
            const last = u.lastName || u.last_name || '';
            const full = `${first} ${last}`.trim();
            return { id: u.id, name: full ? `Dr. ${full}` : u.email };
          });
      },
      error: () => {
        this.dentists = [];
      }
    });
  }

  onDateChange(): void {
    this.loadAppointments();
  }

  loadAppointments(): void {
    this.isLoading = true;
    const dateStr = formatLocalDate(this.selectedDate);

    this.appointmentService.getAppointments(1, 1000, undefined, undefined, dateStr, dateStr).subscribe({
      next: (response) => {
        this.appointments = (response.appointments || []).map((a: any) => DataMapper.mapAppointment(a));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading appointments:', error);
        this.snackBar.open('Randevular yuklenirken hata olustu', 'Kapat', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  getSlotAppointment(slot: TimeSlot, dentistId: number): Appointment | undefined {
    const dateStr = formatLocalDate(this.selectedDate);
    const slotTimeMinutes = slot.hour * 60 + slot.minute;

    return this.appointments.find(apt => {
      const aptDate = (apt.appointmentDate || apt.appointment_date || '').split('T')[0];
      if (aptDate !== dateStr) return false;

      const aptDentistId = apt.dentistId || apt.dentist_id;
      if (aptDentistId !== dentistId) return false;

      const startTime = apt.startTime || apt.start_time || '';
      const endTime = apt.endTime || apt.end_time || '';
      const startParts = startTime.split(':');
      const endParts = endTime.split(':');
      const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
      const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

      return slotTimeMinutes >= startMinutes && slotTimeMinutes < endMinutes;
    });
  }

  getSlotClass(slot: TimeSlot, dentistId: number): string {
    const appointment = this.getSlotAppointment(slot, dentistId);
    if (!appointment) return 'available';
    if (appointment.status === 'cancelled' || appointment.status === 'no_show') return 'unavailable';
    return 'occupied';
  }

  onSlotClick(slot: TimeSlot, dentistId: number): void {
    const appointment = this.getSlotAppointment(slot, dentistId);
    if (appointment) {
      this.openAppointmentDetails(appointment);
      return;
    }

    const endMinute = slot.minute === 30 ? 0 : 30;
    const endHour = slot.minute === 30 ? slot.hour + 1 : slot.hour;

    const newAppointment: Partial<Appointment> = {
      appointmentDate: formatLocalDate(this.selectedDate),
      startTime: `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}:00`,
      endTime: `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00`,
      dentistId,
      status: 'scheduled'
    };
    this.openAppointmentForm(newAppointment as Appointment);
  }

  openAppointmentDetails(appointment: Appointment): void {
    const dialogRef = this.dialog.open(AppointmentDetailsDialogComponent, {
      width: '520px',
      data: appointment
    });

    dialogRef.afterClosed().subscribe((result: { action?: string } | undefined) => {
      if (!result?.action) return;
      if (result.action === 'edit') {
        this.openAppointmentForm(appointment);
      }
      if (result.action === 'cancel') {
        this.cancelAppointment(appointment);
      }
    });
  }

  cancelAppointment(appointment: Appointment): void {
    if (!confirm('Bu randevu iptal edilsin mi?')) return;

    this.appointmentService.cancelAppointment(appointment.id).subscribe({
      next: () => {
        this.snackBar.open('Randevu iptal edildi', 'Kapat', { duration: 2500 });
        this.loadAppointments();
      },
      error: () => {
        this.snackBar.open('Randevu iptal edilemedi', 'Kapat', { duration: 3000 });
      }
    });
  }

  openAppointmentForm(appointment?: Appointment): void {
    const dialogRef = this.dialog.open(AppointmentFormDialogComponent, {
      width: '620px',
      maxWidth: '90vw',
      data: appointment || null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadAppointments();
      }
    });
  }

  statusLabel(status?: string): string {
    if (status === 'scheduled') return 'Planlandi';
    if (status === 'completed') return 'Tamamlandi';
    if (status === 'cancelled') return 'Iptal';
    if (status === 'no_show') return 'Gelmedi';
    if (status === 'in_progress') return 'Devam';
    return status || '-';
  }
}
