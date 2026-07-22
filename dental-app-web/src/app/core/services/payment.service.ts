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
    dentistName: string | null;
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
 * Finansal hareket defteri kaydı (backend: financial_transactions).
 * Onay bekleyen yüksek indirim/iade talepleri bu şekilde temsil edilir.
 */
export interface FinancialTransaction {
    id: number;
    patientId: number;
    patientName: string;
    transactionType: 'charge' | 'payment' | 'discount' | 'refund' | 'reversal' | 'adjustment' | 'write_off';
    amount: number;
    currency: string;
    treatmentPlanId: number | null;
    paymentId: number | null;
    status: 'completed' | 'pending_approval' | 'rejected' | 'reversed';
    reason: string | null;
    createdByName: string | null;
    createdByEmail: string | null;
    createdAt: string;
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

    /**
     * Bir ödemeyi iade eder. Patron (admin) için hemen uygulanır; sekreter
     * için patron onayı bekleyen bir talep oluşturur (backend 202 + pending:true
     * döner). `amount` verilmezse ödemenin kalan iade edilebilir tamamı iade edilir.
     */
    refundPayment(paymentId: number, payload: { amount?: number; reason: string }): Observable<{ pending: boolean; transaction: any }> {
        return this.apiService.post<{ pending: boolean; transaction: any }>(`/api/payments/${paymentId}/refund`, payload);
    }

    /** Patron onayı bekleyen yüksek indirim/iade talepleri. */
    getPendingApprovals(): Observable<FinancialTransaction[]> {
        return this.apiService.get<{ approvals: any[] }>('/api/payments/approvals/pending').pipe(
            map(res => (res.approvals ?? []).map(a => this.mapTransaction(a)))
        );
    }

    /** Sadece patron (admin) — bekleyen talebi onaylar, asıl bakiye/plan etkisi burada uygulanır. */
    approveTransaction(id: number): Observable<unknown> {
        return this.apiService.post(`/api/payments/approvals/${id}/approve`, {});
    }

    /** Sadece patron (admin) — bekleyen talebi reddeder, hiçbir bakiye/plan etkisi olmaz. */
    rejectTransaction(id: number, reason?: string): Observable<unknown> {
        return this.apiService.post(`/api/payments/approvals/${id}/reject`, { reason });
    }

    private mapTransaction(t: any): FinancialTransaction {
        return {
            id: t.id,
            patientId: t.patient_id ?? t.patientId,
            patientName: t.patient_name ?? t.patientName ?? '',
            transactionType: t.transaction_type ?? t.transactionType,
            amount: parseFloat(t.amount ?? 0),
            currency: t.currency ?? 'TRY',
            treatmentPlanId: t.treatment_plan_id ?? t.treatmentPlanId ?? null,
            paymentId: t.payment_id ?? t.paymentId ?? null,
            status: t.status,
            reason: t.reason ?? null,
            createdByName: t.created_by_name ?? t.createdByName ?? null,
            createdByEmail: t.created_by_email ?? t.createdByEmail ?? null,
            createdAt: t.created_at ?? t.createdAt ?? ''
        };
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
            dentistName: plan.dentist_name ?? plan.dentistName ?? null,
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
