import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { DashboardService, DashboardStats } from '../../core/services/dashboard.service';
import { User, Appointment } from '../../core/models/models';
import { DataMapper } from '../../core/utils/data-mapper';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatGridListModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dashboard-container">
      <div class="clock-bar" *ngIf="isSecretary || isDentist">
        <span>{{ now | date:'dd.MM.yyyy HH:mm:ss' }}</span>
      </div>

      <div *ngIf="isAdmin" class="admin-dashboard">
        <h1>Admin Kontrol Paneli</h1>
        <mat-grid-list cols="4" rowHeight="150px" gutterSize="16px">
          <mat-grid-tile *ngFor="let c of adminCards">
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-value">{{ c.value }}</div>
                <div class="stat-label">{{ c.label }}</div>
              </mat-card-content>
            </mat-card>
          </mat-grid-tile>
        </mat-grid-list>
      </div>

      <div *ngIf="isDentist || isSecretary" class="ops-dashboard">
        <h1>{{ isDentist ? 'Dis Hekimi Kontrol Paneli' : 'Sekreter Kontrol Paneli' }}</h1>

        <div class="summary-row">
          <mat-card>
            <mat-card-content>
              <div class="stat-value">{{ upcomingAppointments.length }}</div>
              <div class="stat-label">Yaklasan Randevu</div>
            </mat-card-content>
          </mat-card>
          <mat-card>
            <mat-card-content>
              <div class="stat-value">{{ todayCount }}</div>
              <div class="stat-label">Bugun Randevu</div>
            </mat-card-content>
          </mat-card>
        </div>

        <mat-card class="appointments-card">
          <mat-card-header>
            <mat-card-title>{{ isSecretary ? 'Bugun ve Yarin Randevulari' : 'Yaklasan Randevular' }}</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-list *ngIf="upcomingAppointments.length > 0; else noAppointments">
              <mat-list-item *ngFor="let apt of upcomingAppointments" (click)="onAppointmentClick(apt)" class="appointment-item">
                <mat-icon matListItemIcon>event</mat-icon>
                <div matListItemTitle>{{ formatDate(apt.appointmentDate || apt.appointment_date) }} {{ apt.startTime || apt.start_time }}</div>
                <div matListItemLine>{{ apt.patientFirstName || apt.patient_first_name }} {{ apt.patientLastName || apt.patient_last_name }}</div>
              </mat-list-item>
            </mat-list>
            <ng-template #noAppointments>
              <p>Randevu bulunmamaktadir.</p>
            </ng-template>
          </mat-card-content>
        </mat-card>
      </div>

      <div *ngIf="isLoading" class="loading">
        <mat-spinner></mat-spinner>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 20px; }
    .clock-bar { margin-bottom: 12px; color: #1e3a8a; font-weight: 600; }
    h1 { color: #1E3A8A; margin-bottom: 20px; }
    .summary-row { display: grid; grid-template-columns: repeat(2, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px; }
    .stat-card { height: 100%; text-align: center; }
    .stat-value { font-size: 30px; font-weight: bold; color: #3B82F6; }
    .stat-label { font-size: 14px; color: #666; margin-top: 8px; }
    .appointments-card { margin-top: 12px; }
    .appointment-item { cursor: pointer; }
    .appointment-item:hover { background-color: #f5f5f5; }
    .loading { display: flex; justify-content: center; align-items: center; height: 200px; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isAdmin = false;
  isDentist = false;
  isSecretary = false;
  isLoading = false;
  stats: DashboardStats | null = null;
  adminCards: Array<{ label: string; value: string | number }> = [];
  upcomingAppointments: Appointment[] = [];
  todayCount = 0;
  now = new Date();
  private timer: any;

  constructor(
    private authService: AuthService,
    private appointmentService: AppointmentService,
    private dashboardService: DashboardService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.timer = setInterval(() => this.now = new Date(), 1000);

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.isAdmin = user.roles.includes('admin');
        this.isDentist = user.roles.includes('dentist');
        this.isSecretary = user.roles.includes('secretary');
        this.loadDashboardData();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  loadDashboardData(): void {
    this.isLoading = true;

    if (this.isAdmin) {
      this.dashboardService.getAdminStats().subscribe({
        next: (stats) => {
          this.stats = stats;
          this.adminCards = [
            { label: 'Toplam Hasta', value: stats.totalPatients || 0 },
            { label: 'Gecen Ay Finansal', value: this.formatCurrency(stats.lastMonthFinancial) },
            { label: 'Gecen Ay Hasta', value: stats.lastMonthPatients || 0 },
            { label: 'Gecen Ay Islem', value: stats.lastMonthTransactions || 0 },
            { label: 'Bu Ay Hasta', value: stats.thisMonthPatients || 0 },
            { label: 'Bu Ay Finansal', value: this.formatCurrency(stats.thisMonthFinancial) },
            { label: 'Yaklasan Randevu', value: stats.upcomingAppointmentsCount || 0 }
          ];
          this.isLoading = false;
        },
        error: () => {
          this.adminCards = [];
          this.isLoading = false;
        }
      });
      return;
    }

    const today = new Date();
    const start = today.toISOString().split('T')[0];
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + (this.isSecretary ? 1 : 7));
    const end = endDate.toISOString().split('T')[0];

    this.appointmentService.getAppointments(1, 100, undefined, undefined, start, end).subscribe({
      next: (response) => {
        const mapped = (response.appointments || []).map((a: any) => DataMapper.mapAppointment(a));
        this.upcomingAppointments = mapped.sort((a, b) => {
          const aDate = new Date(`${a.appointmentDate || a.appointment_date}T${a.startTime || a.start_time}`).getTime();
          const bDate = new Date(`${b.appointmentDate || b.appointment_date}T${b.startTime || b.start_time}`).getTime();
          return aDate - bDate;
        });

        const todayStr = today.toISOString().split('T')[0];
        this.todayCount = this.upcomingAppointments.filter(a => (a.appointmentDate || a.appointment_date || '').split('T')[0] === todayStr).length;
        this.isLoading = false;
      },
      error: () => {
        this.upcomingAppointments = [];
        this.todayCount = 0;
        this.isLoading = false;
      }
    });
  }

  onAppointmentClick(appointment: Appointment): void {
    const mapped = DataMapper.mapAppointment(appointment);
    this.router.navigate(['/treatments'], {
      queryParams: {
        patientId: mapped.patientId || mapped.patient_id,
        appointmentId: mapped.id
      }
    });
  }

  formatDate(date?: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatCurrency(amount?: number): string {
    if (!amount) return '₺0';
    return `₺${amount.toLocaleString('tr-TR')}`;
  }
}
