import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Appointment, AppointmentsResponse, PaginatedResponse } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  constructor(private apiService: ApiService) {}

  getAppointments(
    page: number = 1,
    limit: number = 20,
    patientId?: number,
    dentistId?: number,
    startDate?: string,
    endDate?: string,
    status?: string
  ): Observable<AppointmentsResponse> {
    const params: any = { page, limit };
    if (patientId) params.patientId = patientId;
    if (dentistId) params.dentistId = dentistId;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (status) params.status = status;
    return this.apiService.get<AppointmentsResponse>('/api/appointments', params);
  }

  getAppointment(id: number): Observable<{ appointment: Appointment }> {
    return this.apiService.get<{ appointment: Appointment }>(`/api/appointments/${id}`);
  }

  createAppointment(appointment: Partial<Appointment>): Observable<{ appointment: Appointment }> {
    return this.apiService.post<{ appointment: Appointment }>('/api/appointments', appointment);
  }

  updateAppointment(id: number, appointment: Partial<Appointment>): Observable<{ appointment: Appointment }> {
    return this.apiService.put<{ appointment: Appointment }>(`/api/appointments/${id}`, appointment);
  }

  cancelAppointment(id: number, reason?: string): Observable<void> {
    return this.apiService.put<void>(`/api/appointments/${id}/cancel`, { reason });
  }
}
