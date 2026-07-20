import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

/** Hasta borç özeti (backend: patient_debts satırı ya da sıfır-durumunda camelCase nesne). */
export interface PatientDebt {
    patientId: number;
    totalDebt: number;
    paidAmount: number;
    remainingDebt: number;
}

/** Bekleyen tedavi planı (backend: GET /api/payments/pending-plans). */
export interface PendingPlan {
    id: number;
    patientId: number;
    dentistId: number | null;
    patientName: string;
    dentistEmail: string | null;
    title: string | null;
    status: string;
    totalEstimatedCost: number;
    createdAt: string;
    items: PendingPlanItem[];
}

export interface PendingPlanItem {
    id: number;
    treatmentType: string | null;
    toothNumber: string | null;
    cost: number;
}

/** Ödeme kaydı (backend: GET /api/payments/patient-payments/:patientId). */
export interface PaymentRecord {
    id: number;
    amount: number;
    paymentMethod: string;
    createdAt: string;
    notes: string | null;
}

/**
 * Ödeme API servisi — desktop PaymentsViewModel ile aynı backend uçlarını kullanır
 * (src/routes/payments.js).
 */
@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    constructor(private apiService: ApiService) {}

    getPendingPlans(): Observable<PendingPlan[]> {
        return this.apiService.get<{ plans: any[] }>('/api/payments/pending-plans').pipe(
            map(res => (res.plans ?? []).map(p => this.mapPlan(p)))
        );
    }

    approvePlan(planId: number, approved: boolean): Observable<unknown> {
        return this.apiService.post(`/api/payments/approve-plan/${planId}`, { approved });
    }

    getPatientDebt(patientId: number): Observable<PatientDebt> {
        return this.apiService.get<{ debt: any }>(`/api/payments/patient-debt/${patientId}`).pipe(
            map(res => this.mapDebt(res.debt, patientId))
        );
    }

    processPayment(payload: {
        patientId: number;
        amount: number;
        paymentMethod: 'card' | 'cash';
        treatmentPlanId?: number | null;
        notes?: string;
    }): Observable<unknown> {
        return this.apiService.post('/api/payments/process', payload);
    }

    applyDiscount(payload: {
        treatmentPlanId: number;
        discountAmount?: number;
        discountPercentage?: number;
    }): Observable<unknown> {
        return this.apiService.post('/api/payments/discount', payload);
    }

    getTotalReceivables(): Observable<number> {
        return this.apiService.get<{ totalReceivables: number }>('/api/payments/total-receivables').pipe(
            map(res => res.totalReceivables ?? 0)
        );
    }

    getTotalIncome(): Observable<number> {
        return this.apiService.get<{ totalIncome: number }>('/api/payments/total-income').pipe(
            map(res => res.totalIncome ?? 0)
        );
    }

    getPatientPayments(patientId: number): Observable<PaymentRecord[]> {
        return this.apiService.get<{ payments: any[] }>(`/api/payments/patient-payments/${patientId}`).pipe(
            map(res => (res.payments ?? []).map(p => ({
                id: p.id,
                amount: parseFloat(p.amount ?? 0),
                paymentMethod: p.payment_method ?? p.paymentMethod ?? '',
                createdAt: p.created_at ?? p.createdAt ?? '',
                notes: p.notes ?? null
            })))
        );
    }

    /** Borç yanıtı iki şekilde gelebilir: DB satırı (snake_case) ya da sıfır-durum (camelCase). */
    private mapDebt(debt: any, patientId: number): PatientDebt {
        return {
            patientId: debt?.patient_id ?? debt?.patientId ?? patientId,
            totalDebt: parseFloat(debt?.total_debt ?? debt?.totalDebt ?? 0),
            paidAmount: parseFloat(debt?.paid_amount ?? debt?.paidAmount ?? 0),
            remainingDebt: parseFloat(debt?.remaining_debt ?? debt?.remainingDebt ?? 0)
        };
    }

    private mapPlan(plan: any): PendingPlan {
        return {
            id: plan.id,
            patientId: plan.patient_id ?? plan.patientId,
            dentistId: plan.dentist_id ?? plan.dentistId ?? null,
            patientName: plan.patient_name ?? plan.patientName ?? '',
            dentistEmail: plan.dentist_email ?? plan.dentistEmail ?? null,
            title: plan.title ?? null,
            status: plan.status,
            totalEstimatedCost: parseFloat(plan.total_estimated_cost ?? plan.totalEstimatedCost ?? 0),
            createdAt: plan.created_at ?? plan.createdAt ?? '',
            items: (plan.items ?? []).map((i: any) => ({
                id: i.id,
                treatmentType: i.treatment_type ?? i.treatmentType ?? null,
                toothNumber: i.tooth_number ?? i.toothNumber ?? null,
                cost: parseFloat(i.cost ?? 0)
            }))
        };
    }
}
