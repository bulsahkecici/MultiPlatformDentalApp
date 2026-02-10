import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface DashboardStats {
  totalPatients: number;
  lastMonthFinancial: number;
  lastMonthPatients: number;
  lastMonthTransactions: number;
  thisMonthPatients: number;
  thisMonthFinancial: number;
  upcomingAppointmentsCount: number;
}

export interface AdminStatistics {
  statistics: {
    totalPatients?: number;
    lastMonthFinancial?: number;
    lastMonthPatients?: number;
    lastMonthTransactions?: number;
    thisMonthPatients?: number;
    thisMonthFinancial?: number;
    upcomingAppointmentsCount?: number;
    patients: { total: number };
    appointments: { total: number; completed: number; cancelled: number };
    treatments: { total: number; totalRevenue: number };
    invoices: { total: number; totalRevenue: number; paidRevenue: number };
    dentists: { total: number };
  };
}

export interface DentistEarnings {
  earnings: {
    totalTurnover: number;
    paidTurnoverShare: number;
    totalEarnings: number;
    salary: number;
    commissionRate: number;
    treatmentCount: number;
  };
  treatments: any[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  constructor(private apiService: ApiService) {}

  getAdminStats(): Observable<DashboardStats> {
    return this.apiService.get<AdminStatistics>('/api/admin/statistics').pipe(
      map(response => {
        const stats = response.statistics;
        return {
          totalPatients: stats.totalPatients || stats.patients.total,
          lastMonthFinancial: stats.lastMonthFinancial || 0,
          lastMonthPatients: stats.lastMonthPatients || 0,
          lastMonthTransactions: stats.lastMonthTransactions || 0,
          thisMonthPatients: stats.thisMonthPatients || 0,
          thisMonthFinancial: stats.thisMonthFinancial || 0,
          upcomingAppointmentsCount: stats.upcomingAppointmentsCount || 0
        };
      })
    );
  }

  getDentistEarnings(startDate?: string, endDate?: string): Observable<DentistEarnings> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return this.apiService.get<DentistEarnings>('/api/dentist/earnings', params);
  }
}
