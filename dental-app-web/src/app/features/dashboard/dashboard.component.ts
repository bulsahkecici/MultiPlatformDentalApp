import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { DashboardService, DashboardStats } from '../../core/services/dashboard.service';
import { User, Appointment } from '../../core/models/models';
import { DataMapper } from '../../core/utils/data-mapper';

interface StatCard {
  value: string;
  label: string;
  icon: string;
  tone: 'blue' | 'green' | 'amber' | 'slate';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>{{ greeting() }}</h1>
          <p class="page-subtitle">{{ today() }}</p>
        </div>
      </div>

      <div *ngIf="isLoading" class="loading">
        <mat-spinner diameter="36"></mat-spinner>
      </div>

      <!-- Admin Dashboard -->
      <div *ngIf="isAdmin && !isLoading" class="stat-grid">
        <div class="stat-card" *ngFor="let card of adminCards()">
          <div class="stat-icon" [class]="'tone-' + card.tone">
            <mat-icon>{{ card.icon }}</mat-icon>
          </div>
          <div class="stat-body">
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </div>
      </div>

      <!-- Dentist / Secretary appointment list -->
      <div *ngIf="(isDentist || isSecretary) && !isLoading" class="appointments-section">
        <div class="surface-card appointments-card">
          <div class="card-heading">
            <mat-icon>event_available</mat-icon>
            <h2>{{ isDentist ? 'Yaklaşan Randevularım' : 'Bugün ve Yarın Randevuları' }}</h2>
          </div>

          <div *ngIf="upcomingAppointments.length === 0" class="empty-state">
            <mat-icon>event_busy</mat-icon>
            <div class="empty-title">Randevu bulunmuyor</div>
            <div class="empty-hint">{{ isDentist ? 'Yaklaşan bir randevunuz yok.' : 'Bugün veya yarın için randevu yok.' }}</div>
          </div>

          <mat-list *ngIf="upcomingAppointments.length > 0">
            <mat-list-item *ngFor="let apt of upcomingAppointments"
                         (click)="onAppointmentClick(apt)"
                         class="appointment-item">
              <mat-icon matListItemIcon class="apt-icon">event</mat-icon>
              <div matListItemTitle>{{ apt.patientFirstName || apt.patient_first_name }} {{ apt.patientLastName || apt.patient_last_name }}</div>
              <div matListItemLine>{{ formatDate(apt.appointmentDate || apt.appointment_date) }} · {{ (apt.startTime || apt.start_time || '').substring(0,5) }}</div>
            </mat-list-item>
          </mat-list>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px; }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 240px;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }
    .stat-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      border: 1px solid rgba(15, 23, 42, 0.04);
      padding: 18px 20px;
      transition: box-shadow 0.15s ease, transform 0.15s ease;
    }
    .stat-card:hover {
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }
    .stat-icon {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .stat-icon mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .tone-blue  { background: var(--bulka-primary-50, #eff6ff); color: var(--bulka-primary-700, #1d4ed8); }
    .tone-green { background: var(--success-50); color: var(--success-600); }
    .tone-amber { background: var(--amber-50); color: var(--amber-600); }
    .tone-slate { background: #f1f5f9; color: var(--ink-500); }
    .stat-body { min-width: 0; }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--ink-900);
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stat-label {
      font-size: 13px;
      color: var(--ink-500);
      margin-top: 2px;
    }
    .appointments-section { margin-top: 8px; }
    .appointments-card { padding: 8px 8px 8px; }
    .card-heading {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 16px 8px;
    }
    .card-heading mat-icon {
      color: var(--bulka-primary-600, #2563eb);
    }
    .card-heading h2 {
      font-size: 16px;
      margin: 0;
    }
    .appointment-item {
      cursor: pointer;
      border-radius: var(--radius-sm);
    }
    .appointment-item:hover {
      background-color: var(--surface-muted);
    }
    .apt-icon {
      color: var(--bulka-primary-600, #2563eb);
    }
  `]
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  isAdmin = false;
  isDentist = false;
  isSecretary = false;
  isLoading = false;
  stats: DashboardStats | null = null;
  upcomingAppointments: Appointment[] = [];

  constructor(
    private authService: AuthService,
    private appointmentService: AppointmentService,
    private dashboardService: DashboardService,
    private router: Router
  ) {}

  ngOnInit(): void {
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

  loadDashboardData(): void {
    this.isLoading = true;
    
    if (this.isAdmin) {
      this.loadAdminDashboard();
    } else if (this.isDentist) {
      this.loadDentistDashboard();
    } else if (this.isSecretary) {
      this.loadSecretaryDashboard();
    }
  }

  loadAdminDashboard(): void {
    this.dashboardService.getAdminStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading admin stats:', error);
        // Fallback to empty stats if endpoint doesn't exist yet
        this.stats = {
          totalPatients: 0,
          lastMonthFinancial: 0,
          lastMonthPatients: 0,
          lastMonthTransactions: 0,
          thisMonthPatients: 0,
          thisMonthFinancial: 0,
          upcomingAppointmentsCount: 0
        };
        this.isLoading = false;
      }
    });
  }

  loadDentistDashboard(): void {
    const today = new Date().toISOString().split('T')[0];
    // Backend automatically filters by dentist ID when user is dentist
    this.appointmentService.getAppointments(1, 100, undefined, undefined, today).subscribe({
      next: (response) => {
        // Map backend data to frontend format
        this.upcomingAppointments = (response.appointments || []).map((a: any) => DataMapper.mapAppointment(a));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading dentist appointments:', error);
        this.isLoading = false;
      }
    });
  }

  loadSecretaryDashboard(): void {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    this.appointmentService.getAppointments(1, 100, undefined, undefined, todayStr, tomorrowStr).subscribe({
      next: (response) => {
        // Map backend data to frontend format and filter for today and tomorrow
        const mapped = (response.appointments || []).map((a: any) => DataMapper.mapAppointment(a));
        this.upcomingAppointments = mapped.filter((apt: Appointment) => {
          const aptDate = (apt.appointmentDate || apt.appointment_date || '').split('T')[0];
          return aptDate === todayStr || aptDate === tomorrowStr;
        });
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading secretary appointments:', error);
        this.isLoading = false;
      }
    });
  }

  onAppointmentClick(appointment: Appointment): void {
    // Randevu kartına tıklandığında tedavi detaylarını aç
    // Önce planlanmış tedavileri kontrol et
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

  greeting(): string {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
    const name = this.currentUser?.email?.split('@')[0] || '';
    return `${timeGreeting}${name ? ', ' + name : ''}`;
  }

  today(): string {
    return new Date().toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  adminCards(): StatCard[] {
    const s = this.stats;
    return [
      { value: `${s?.totalPatients ?? 0}`, label: 'Toplam Hasta', icon: 'groups', tone: 'blue' },
      { value: `${s?.upcomingAppointmentsCount ?? 0}`, label: 'Yaklaşan Randevu', icon: 'event_upcoming', tone: 'amber' },
      { value: this.formatCurrency(s?.thisMonthFinancial), label: 'Bu Ay Finansal', icon: 'payments', tone: 'green' },
      { value: `${s?.thisMonthPatients ?? 0}`, label: 'Bu Ay Yeni Hasta', icon: 'person_add', tone: 'blue' },
      { value: this.formatCurrency(s?.lastMonthFinancial), label: 'Geçen Ay Finansal', icon: 'account_balance_wallet', tone: 'slate' },
      { value: `${s?.lastMonthPatients ?? 0}`, label: 'Geçen Ay Yeni Hasta', icon: 'person_outline', tone: 'slate' },
      { value: `${s?.lastMonthTransactions ?? 0}`, label: 'Geçen Ay İşlem', icon: 'receipt_long', tone: 'slate' },
    ];
  }
}
