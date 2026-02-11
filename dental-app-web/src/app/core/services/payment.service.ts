import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PendingPlanItem {
  id: number;
  treatment_plan_id: number;
  tooth_number: number;
  treatment_type: string;
  cost: number;
  currency: string;
  notes?: string;
}

export interface PendingPlan {
  id: number;
  patient_id: number;
  dentist_id: number;
  title: string;
  description?: string;
  status: string;
  total_estimated_cost?: number;
  patient_name?: string;
  dentist_email?: string;
  items: PendingPlanItem[];
}

export interface PatientPaymentHistory {
  id: number;
  amount: number;
  payment_method: string;
  created_at: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  constructor(private apiService: ApiService) {}

  getPendingPlans(): Observable<{ plans: PendingPlan[] }> {
    return this.apiService.get<{ plans: PendingPlan[] }>('/api/payments/pending-plans');
  }

  approvePlan(id: number, approved: boolean = true): Observable<any> {
    return this.apiService.post<any>(`/api/payments/approve-plan/${id}`, { approved });
  }

  getTotalReceivables(): Observable<{ totalReceivables: number }> {
    return this.apiService.get<{ totalReceivables: number }>('/api/payments/total-receivables');
  }

  getTotalIncome(): Observable<{ totalIncome: number }> {
    return this.apiService.get<{ totalIncome: number }>('/api/payments/total-income');
  }

  getPatientDebt(patientId: number): Observable<{ debt: any }> {
    return this.apiService.get<{ debt: any }>(`/api/payments/patient-debt/${patientId}`);
  }

  getPatientPayments(patientId: number): Observable<{ payments: PatientPaymentHistory[] }> {
    return this.apiService.get<{ payments: PatientPaymentHistory[] }>(`/api/payments/patient-payments/${patientId}`);
  }

  getApprovedPlans(patientId: number): Observable<{ plans: PendingPlan[] }> {
    return this.apiService.get<{ plans: PendingPlan[] }>('/api/treatment-plans', { patientId, status: 'approved' });
  }

  processPayment(payload: {
    patientId: number;
    treatmentPlanId?: number | null;
    amount: number;
    paymentMethod: string;
    notes?: string | null;
  }): Observable<any> {
    return this.apiService.post<any>('/api/payments/process', payload);
  }
}
