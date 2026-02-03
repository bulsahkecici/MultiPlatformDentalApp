import { Component, OnInit } from '@angular/core';
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
      <!-- Admin Dashboard -->
      <div *ngIf="isAdmin" class="admin-dashboard">
        <h1>Admin Kontrol Paneli</h1>
        
        <mat-grid-list cols="4" rowHeight="150px" gutterSize="16px">
          <mat-grid-tile>
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-value">{{ stats?.totalPatients || 0 }}</div>
                <div class="stat-label">Toplam Hasta</div>
              </mat-card-content>
            </mat-card>
          </mat-grid-tile>
          
          <mat-grid-tile>
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-value">{{ formatCurrency(stats?.lastMonthFinancial) }}</div>
                <div class="stat-label">Geçen Ay Finansal</div>
              </mat-card-content>
            </mat-card>
          </mat-grid-tile>
          
          <mat-grid-tile>
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-value">{{ stats?.lastMonthPatients || 0 }}</div>
                <div class="stat-label">Geçen Ay Hasta</div>
              </mat-card-content>
            </mat-card>
          </mat-grid-tile>
          
          <mat-grid-tile>
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-value">{{ stats?.lastMonthTransactions || 0 }}</div>
                <div class="stat-label">Geçen Ay İşlem</div>
              </mat-card-content>
            </mat-card>
          </mat-grid-tile>
          
          <mat-grid-tile>
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-value">{{ stats?.thisMonthPatients || 0 }}</div>
                <div class="stat-label">Bu Ay Hasta</div>
              </mat-card-content>
            </mat-card>
          </mat-grid-tile>
          
          <mat-grid-tile>
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-value">{{ formatCurrency(stats?.thisMonthFinancial) }}</div>
                <div class="stat-label">Bu Ay Finansal</div>
              </mat-card-content>
            </mat-card>
          </mat-grid-tile>
          
          <mat-grid-tile>
            <mat-card class="stat-card">
              <mat-card-content>
                <div class="stat-value">{{ stats?.upcomingAppointmentsCount || 0 }}</div>
                <div class="stat-label">Yaklaşan Randevu</div>
              </mat-card-content>
            </mat-card>
          </mat-grid-tile>
        </mat-grid-list>
      </div>

      <!-- Dentist Dashboard -->
      <div *ngIf="isDentist" class="dentist-dashboard">
        <h1>Diş Hekimi Kontrol Paneli</h1>
        
        <mat-card class="appointments-card">
          <mat-card-header>
            <mat-card-title>Yaklaşan Randevular</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-list *ngIf="upcomingAppointments.length > 0; else noAppointments">
              <mat-list-item *ngFor="let apt of upcomingAppointments" 
                           (click)="onAppointmentClick(apt)"
                           class="appointment-item">
                <mat-icon matListItemIcon>event</mat-icon>
                <div matListItemTitle>{{ formatDate(apt.appointmentDate || apt.appointment_date) }} {{ apt.startTime || apt.start_time }}</div>
                <div matListItemLine>{{ apt.patientFirstName || apt.patient_first_name }} {{ apt.patientLastName || apt.patient_last_name }}</div>
              </mat-list-item>
            </mat-list>
            <ng-template #noAppointments>
              <p>Yaklaşan randevu bulunmamaktadır.</p>
            </ng-template>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Secretary Dashboard -->
      <div *ngIf="isSecretary" class="secretary-dashboard">
        <h1>Sekreter Kontrol Paneli</h1>
        
        <mat-card class="appointments-card">
          <mat-card-header>
            <mat-card-title>Bugün ve Yarın Randevuları</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-list *ngIf="upcomingAppointments.length > 0; else noAppointments">
              <mat-list-item *ngFor="let apt of upcomingAppointments" 
                           (click)="onAppointmentClick(apt)"
                           class="appointment-item">
                <mat-icon matListItemIcon>event</mat-icon>
                <div matListItemTitle>{{ formatDate(apt.appointmentDate || apt.appointment_date) }} {{ apt.startTime || apt.start_time }}</div>
                <div matListItemLine>{{ apt.patientFirstName || apt.patient_first_name }} {{ apt.patientLastName || apt.patient_last_name }}</div>
              </mat-list-item>
            </mat-list>
            <ng-template #noAppointments>
              <p>Bugün ve yarın için randevu bulunmamaktadır.</p>
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
    .dashboard-container {
      padding: 20px;
    }
    h1 {
      color: #1E3A8A;
      margin-bottom: 20px;
    }
    .stat-card {
      height: 100%;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #3B82F6;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 8px;
    }
    .appointments-card {
      margin-top: 20px;
    }
    .appointment-item {
      cursor: pointer;
    }
    .appointment-item:hover {
      background-color: #f5f5f5;
    }
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
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
}
