import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule, MatTabChangeEvent } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { AuthService } from '../../core/services/auth.service';
import { InstitutionAgreementService, InstitutionAgreement } from '../../core/services/institution-agreement.service';
import { PaymentService, PendingPlan, PatientPaymentHistory } from '../../core/services/payment.service';
import { PatientService } from '../../core/services/patient.service';
import { Patient } from '../../core/models/models';
import { DataMapper } from '../../core/utils/data-mapper';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatListModule,
    MatCheckboxModule,
    MatExpansionModule
  ],
  template: `
    <div class="payments-container">
      <h1>Odeme ve Indirim Yonetimi</h1>

      <div class="summary-cards" *ngIf="isAdmin || isSecretary">
        <mat-card>
          <mat-card-title>Toplam Alacak</mat-card-title>
          <mat-card-content>{{ totalReceivables | number:'1.2-2' }} TL</mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-title>Toplam Tahsilat</mat-card-title>
          <mat-card-content>{{ totalIncome | number:'1.2-2' }} TL</mat-card-content>
        </mat-card>
      </div>

      <mat-tab-group (selectedTabChange)="onTabChange($event)">
        <mat-tab label="Anlasmali Kurumlar">
          <div class="agreements-layout">
            <mat-card class="agreements-list">
              <mat-card-header>
                <mat-card-title>Kurumlar</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="row-actions" *ngIf="isAdmin || isSecretary">
                  <button mat-raised-button color="primary" (click)="startCreateAgreement()">Yeni Kurum</button>
                  <button mat-stroked-button (click)="cancelAgreementEdit()" *ngIf="isAgreementFormVisible">Vazgec</button>
                </div>
                <mat-list>
                  <mat-list-item *ngFor="let agreement of agreements"
                                 (click)="selectAgreement(agreement)"
                                 [class.selected]="selectedAgreement?.id === agreement.id">
                    {{ agreement.institution_name }}
                  </mat-list-item>
                </mat-list>
              </mat-card-content>
            </mat-card>

            <mat-card class="agreement-details">
              <mat-card-header>
                <mat-card-title>{{ editingAgreementId ? 'Kurum Duzenle' : (selectedAgreement ? selectedAgreement.institution_name : 'Kurum Detayi') }}</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <form *ngIf="isAgreementFormVisible" class="agreement-form">
                  <mat-form-field appearance="outline">
                    <mat-label>Kurum Adi</mat-label>
                    <input matInput [(ngModel)]="agreementForm.institution_name" name="institution_name">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Yetkili</mat-label>
                    <input matInput [(ngModel)]="agreementForm.contact_person" name="contact_person">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Telefon</mat-label>
                    <input matInput [(ngModel)]="agreementForm.contact_phone" name="contact_phone">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>E-posta</mat-label>
                    <input matInput [(ngModel)]="agreementForm.contact_email" name="contact_email">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Genel Indirim (%)</mat-label>
                    <input matInput type="number" [(ngModel)]="agreementForm.discount_percentage" name="discount_percentage" min="0" max="100">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Kategori Indirim JSON</mat-label>
                    <textarea matInput rows="3" [(ngModel)]="agreementCategoryJson" name="category_json"></textarea>
                  </mat-form-field>
                  <div class="row-actions">
                    <button mat-raised-button color="primary" (click)="saveAgreement()">Kaydet</button>
                    <button mat-stroked-button color="warn" *ngIf="editingAgreementId && isAdmin" (click)="deleteAgreement()">Sil</button>
                  </div>
                </form>

                <div *ngIf="selectedAgreement && !isAgreementFormVisible">
                  <p><strong>Iletisim:</strong> {{ selectedAgreement.contact_person || '-' }}</p>
                  <p><strong>Telefon:</strong> {{ selectedAgreement.contact_phone || '-' }}</p>
                  <p><strong>E-posta:</strong> {{ selectedAgreement.contact_email || '-' }}</p>
                  <p><strong>Genel Indirim:</strong> {{ selectedAgreement.discount_percentage }}%</p>
                  <div *ngIf="selectedAgreement.category_discounts">
                    <p><strong>Kategori Bazli Indirimler</strong></p>
                    <ul>
                      <li *ngFor="let key of objectKeys(selectedAgreement.category_discounts)">
                        {{ key }}: {{ selectedAgreement.category_discounts[key] }}%
                      </li>
                    </ul>
                  </div>
                  <div class="row-actions" *ngIf="isAdmin || isSecretary">
                    <button mat-stroked-button color="primary" (click)="startEditAgreement(selectedAgreement)">Duzenle</button>
                    <button mat-stroked-button color="warn" *ngIf="isAdmin" (click)="deleteAgreement()">Sil</button>
                  </div>
                </div>

                <p *ngIf="!selectedAgreement && !isAgreementFormVisible">Soldan bir kurum secin veya yeni kurum ekleyin.</p>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <mat-tab label="Tedavi Plani Onaylama" *ngIf="isSecretary || isAdmin">
          <mat-card>
            <mat-card-header>
              <mat-card-title>Onay Bekleyen Planlar</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="row-actions">
                <button mat-raised-button color="primary" (click)="loadPendingPlans()">Planlari Yukle</button>
                <button mat-raised-button color="accent" (click)="approveSelectedPlans()" [disabled]="selectedPlanIds.size === 0">
                  Secilenleri Onayla
                </button>
                <button mat-raised-button color="warn" (click)="rejectSelectedPlans()" [disabled]="selectedPlanIds.size === 0">
                  Secilenleri Reddet
                </button>
                <span class="total-chip">Secili Toplam: {{ selectedPlansTotal | number:'1.2-2' }} TL</span>
              </div>

              <mat-accordion *ngIf="pendingPlans.length > 0">
                <mat-expansion-panel *ngFor="let plan of pendingPlans">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      <mat-checkbox [checked]="selectedPlanIds.has(plan.id)" (click)="$event.stopPropagation()" (change)="togglePlan(plan.id, $event.checked)"></mat-checkbox>
                      <span class="plan-title">{{ plan.title }} - {{ plan.patient_name || ('Hasta #' + plan.patient_id) }}</span>
                    </mat-panel-title>
                    <mat-panel-description>
                      {{ resolvePlanTotal(plan) | number:'1.2-2' }} TL
                    </mat-panel-description>
                  </mat-expansion-panel-header>

                  <table mat-table [dataSource]="plan.items" class="full-width-table">
                    <ng-container matColumnDef="tooth">
                      <th mat-header-cell *matHeaderCellDef>Dis</th>
                      <td mat-cell *matCellDef="let item">{{ item.tooth_number }}</td>
                    </ng-container>
                    <ng-container matColumnDef="type">
                      <th mat-header-cell *matHeaderCellDef>Islem</th>
                      <td mat-cell *matCellDef="let item">{{ item.treatment_type }}</td>
                    </ng-container>
                    <ng-container matColumnDef="cost">
                      <th mat-header-cell *matHeaderCellDef>Fiyat</th>
                      <td mat-cell *matCellDef="let item">{{ item.cost | number:'1.2-2' }} TL</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="pendingDetailColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: pendingDetailColumns"></tr>
                  </table>
                </mat-expansion-panel>
              </mat-accordion>

              <p class="empty-note" *ngIf="pendingPlans.length === 0">Onay bekleyen plan bulunamadi.</p>
            </mat-card-content>
          </mat-card>
        </mat-tab>

        <mat-tab label="Odeme Isleme" *ngIf="isSecretary || isAdmin">
          <mat-card>
            <mat-card-header>
              <mat-card-title>Odeme Al</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="payment-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Hasta</mat-label>
                  <mat-select [(ngModel)]="selectedPatientId" (selectionChange)="onPaymentPatientChange()">
                    <mat-option *ngFor="let p of patients" [value]="p.id">
                      {{ p.firstName || p.first_name }} {{ p.lastName || p.last_name }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Onayli Plan</mat-label>
                  <mat-select [(ngModel)]="selectedApprovedPlanId" (selectionChange)="onApprovedPlanChange()">
                    <mat-option [value]="null">Plan secmeden</mat-option>
                    <mat-option *ngFor="let plan of approvedPlans" [value]="plan.id">
                      {{ plan.title }} ({{ resolvePlanTotal(plan) | number:'1.2-2' }} TL)
                    </mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Odeme Turu</mat-label>
                  <mat-select [(ngModel)]="paymentMethod">
                    <mat-option value="Nakit">Nakit</mat-option>
                    <mat-option value="Kart">Kart</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Tutar</mat-label>
                  <input matInput type="number" [(ngModel)]="paymentAmount" min="0" step="0.01">
                </mat-form-field>
              </div>

              <div class="debt-box" *ngIf="selectedPatientId">
                <p><strong>Toplam Borc:</strong> {{ selectedPatientTotalDebt | number:'1.2-2' }} TL</p>
                <p><strong>Odenen:</strong> {{ selectedPatientPaidAmount | number:'1.2-2' }} TL</p>
                <p><strong>Kalan:</strong> {{ selectedPatientRemainingDebt | number:'1.2-2' }} TL</p>
              </div>

              <div class="debt-box" *ngIf="lastDentistCommission > 0">
                <p><strong>Son Hekim Ciro Payi:</strong> {{ lastDentistCommission | number:'1.2-2' }} TL</p>
                <p><strong>Ciro Yuzdesi:</strong> {{ lastDentistCommissionRate | number:'1.2-2' }}%</p>
              </div>

              <button mat-raised-button color="primary"
                      (click)="processPayment()"
                      [disabled]="!selectedPatientId || paymentAmount <= 0 || !paymentMethod">
                Odeme Al
              </button>
            </mat-card-content>
          </mat-card>

          <mat-card class="history-card" *ngIf="selectedPatientId">
            <mat-card-header>
              <mat-card-title>Odeme Gecmisi</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <table mat-table [dataSource]="patientPayments" class="full-width-table">
                <ng-container matColumnDef="created_at">
                  <th mat-header-cell *matHeaderCellDef>Tarih</th>
                  <td mat-cell *matCellDef="let p">{{ formatDateTime(p.created_at) }}</td>
                </ng-container>
                <ng-container matColumnDef="amount">
                  <th mat-header-cell *matHeaderCellDef>Tutar</th>
                  <td mat-cell *matCellDef="let p">{{ p.amount | number:'1.2-2' }} TL</td>
                </ng-container>
                <ng-container matColumnDef="payment_method">
                  <th mat-header-cell *matHeaderCellDef>Yontem</th>
                  <td mat-cell *matCellDef="let p">{{ p.payment_method }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="paymentHistoryColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: paymentHistoryColumns"></tr>
              </table>
            </mat-card-content>
          </mat-card>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .payments-container { padding: 20px; }
    .summary-cards { display: grid; grid-template-columns: repeat(2, minmax(240px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .agreements-layout { display: grid; grid-template-columns: 320px 1fr; gap: 20px; margin-top: 20px; }
    .agreement-form { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 10px; }
    .agreements-list mat-list-item { cursor: pointer; }
    .agreements-list mat-list-item:hover { background-color: #f5f5f5; }
    .selected { background-color: #E6F2FF !important; }
    .row-actions { display: flex; gap: 10px; margin-bottom: 12px; align-items: center; }
    .plan-title { margin-left: 8px; }
    .total-chip { margin-left: auto; font-weight: 600; color: #1e40af; }
    .full-width-table { width: 100%; }
    .empty-note { color: #666; margin-top: 8px; }
    .payment-grid { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 12px; margin-bottom: 12px; }
    .debt-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
    .history-card { margin-top: 12px; }
  `]
})
export class PaymentsComponent implements OnInit {
  agreements: InstitutionAgreement[] = [];
  selectedAgreement: InstitutionAgreement | null = null;

  isAgreementFormVisible = false;
  editingAgreementId: number | null = null;
  agreementForm: Partial<InstitutionAgreement> = {};
  agreementCategoryJson = '{}';

  pendingPlans: PendingPlan[] = [];
  approvedPlans: PendingPlan[] = [];
  selectedPlanIds = new Set<number>();
  selectedApprovedPlanId: number | null = null;
  pendingDetailColumns = ['tooth', 'type', 'cost'];

  patients: Patient[] = [];
  selectedPatientId: number | null = null;
  selectedPatientTotalDebt = 0;
  selectedPatientPaidAmount = 0;
  selectedPatientRemainingDebt = 0;
  patientPayments: PatientPaymentHistory[] = [];
  paymentHistoryColumns = ['created_at', 'amount', 'payment_method'];
  paymentAmount = 0;
  paymentMethod = 'Kart';

  lastDentistCommission = 0;
  lastDentistCommissionRate = 0;

  totalReceivables = 0;
  totalIncome = 0;

  isAdmin = false;
  isSecretary = false;

  constructor(
    private authService: AuthService,
    private agreementService: InstitutionAgreementService,
    private paymentService: PaymentService,
    private patientService: PatientService,
    private snackBar: MatSnackBar
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.isAdmin = user.roles.includes('admin');
        this.isSecretary = user.roles.includes('secretary');
      }
    });
  }

  ngOnInit(): void {
    this.loadAgreements();
    if (this.isAdmin || this.isSecretary) {
      this.loadPendingPlans();
      this.loadIncomeExpense();
      this.loadPatients();
    }
  }

  get selectedPlansTotal(): number {
    return this.pendingPlans
      .filter(p => this.selectedPlanIds.has(p.id))
      .reduce((sum, p) => sum + this.resolvePlanTotal(p), 0);
  }

  objectKeys(obj: Record<string, number> | undefined): string[] {
    return obj ? Object.keys(obj) : [];
  }

  loadAgreements(): void {
    this.agreementService.getAgreements().subscribe({
      next: agreements => this.agreements = agreements,
      error: (error) => {
        console.error('Error loading agreements:', error);
        this.snackBar.open('Anlasmalar yuklenirken hata olustu', 'Kapat', { duration: 3000 });
      }
    });
  }

  selectAgreement(agreement: InstitutionAgreement): void {
    this.selectedAgreement = agreement;
    if (!this.isAgreementFormVisible) {
      this.editingAgreementId = null;
    }
  }

  startCreateAgreement(): void {
    this.selectedAgreement = null;
    this.editingAgreementId = null;
    this.agreementForm = { institution_name: '', discount_percentage: 0 };
    this.agreementCategoryJson = '{}';
    this.isAgreementFormVisible = true;
  }

  startEditAgreement(agreement: InstitutionAgreement): void {
    this.selectedAgreement = agreement;
    this.editingAgreementId = agreement.id;
    this.agreementForm = { ...agreement };
    this.agreementCategoryJson = JSON.stringify(agreement.category_discounts || {}, null, 2);
    this.isAgreementFormVisible = true;
  }

  cancelAgreementEdit(): void {
    this.isAgreementFormVisible = false;
    this.editingAgreementId = null;
    this.agreementForm = {};
    this.agreementCategoryJson = '{}';
  }

  parseCategoryDiscounts(): Record<string, number> {
    try {
      const parsed = JSON.parse(this.agreementCategoryJson || '{}');
      if (!parsed || typeof parsed !== 'object') return {};
      const normalized: Record<string, number> = {};
      Object.keys(parsed).forEach(k => {
        const v = Number(parsed[k]);
        if (!Number.isNaN(v) && v > 0) normalized[k] = v;
      });
      return normalized;
    } catch {
      return {};
    }
  }

  saveAgreement(): void {
    if (!this.agreementForm.institution_name?.trim()) {
      this.snackBar.open('Kurum adi zorunludur', 'Kapat', { duration: 2500 });
      return;
    }

    const payload: any = {
      institutionName: this.agreementForm.institution_name,
      contactPerson: this.agreementForm.contact_person || null,
      contactPhone: this.agreementForm.contact_phone || null,
      contactEmail: this.agreementForm.contact_email || null,
      discountPercentage: Number(this.agreementForm.discount_percentage || 0),
      categoryDiscounts: this.parseCategoryDiscounts(),
      notes: this.agreementForm.notes || null
    };

    const req = this.editingAgreementId
      ? this.agreementService.updateAgreement(this.editingAgreementId, payload)
      : this.agreementService.createAgreement(payload);

    req.subscribe({
      next: () => {
        this.snackBar.open('Kurum kaydedildi', 'Kapat', { duration: 2500 });
        this.cancelAgreementEdit();
        this.loadAgreements();
      },
      error: (err) => {
        console.error('Agreement save error:', err);
        this.snackBar.open('Kurum kaydedilemedi', 'Kapat', { duration: 3000 });
      }
    });
  }

  deleteAgreement(): void {
    const id = this.editingAgreementId || this.selectedAgreement?.id;
    if (!id || !this.isAdmin) return;
    if (!confirm('Kurum anlasmasi pasife alinacak. Devam edilsin mi?')) return;

    this.agreementService.deleteAgreement(id).subscribe({
      next: () => {
        this.snackBar.open('Kurum silindi', 'Kapat', { duration: 2500 });
        this.cancelAgreementEdit();
        this.selectedAgreement = null;
        this.loadAgreements();
      },
      error: (err) => {
        console.error('Agreement delete error:', err);
        this.snackBar.open('Kurum silinemedi', 'Kapat', { duration: 3000 });
      }
    });
  }

  loadPendingPlans(): void {
    this.paymentService.getPendingPlans().subscribe({
      next: res => {
        this.pendingPlans = res.plans || [];
        this.selectedPlanIds.clear();
      },
      error: (err) => {
        console.error('Error loading pending plans:', err);
        this.snackBar.open('Planlar yuklenirken hata olustu', 'Kapat', { duration: 3000 });
      }
    });
  }

  resolvePlanTotal(plan: PendingPlan): number {
    if (plan.total_estimated_cost && plan.total_estimated_cost > 0) {
      return plan.total_estimated_cost;
    }
    return (plan.items || []).reduce((sum, item) => sum + (item.cost || 0), 0);
  }

  togglePlan(planId: number, checked: boolean): void {
    if (checked) this.selectedPlanIds.add(planId);
    else this.selectedPlanIds.delete(planId);
  }

  approveSelectedPlans(): void {
    this.processSelectedPlans(true);
  }

  rejectSelectedPlans(): void {
    if (!confirm('Secilen planlar reddedilecek. Devam edilsin mi?')) return;
    this.processSelectedPlans(false);
  }

  onTabChange(event: MatTabChangeEvent): void {
    if (event.tab.textLabel === 'Tedavi Plani Onaylama') {
      this.loadPendingPlans();
    }
  }

  private processSelectedPlans(approved: boolean): void {
    const ids = Array.from(this.selectedPlanIds.values());
    if (ids.length === 0) return;

    let completed = 0;
    const actionLabel = approved ? 'onaylandi' : 'reddedildi';

    ids.forEach(id => {
      this.paymentService.approvePlan(id, approved).subscribe({
        next: () => {
          completed += 1;
          if (completed === ids.length) {
            this.snackBar.open(`${completed} plan ${actionLabel}`, 'Kapat', { duration: 2500 });
            this.loadPendingPlans();
            this.loadIncomeExpense();
          }
        },
        error: (err) => {
          console.error(`Error processing plan ${id}:`, err);
          this.snackBar.open(`Plan islenemedi (ID: ${id})`, 'Kapat', { duration: 3000 });
        }
      });
    });
  }

  loadIncomeExpense(): void {
    this.paymentService.getTotalReceivables().subscribe({ next: r => this.totalReceivables = r.totalReceivables || 0 });
    this.paymentService.getTotalIncome().subscribe({ next: r => this.totalIncome = r.totalIncome || 0 });
  }

  loadPatients(): void {
    this.patientService.getPatients(1, 1000).subscribe({
      next: res => this.patients = (res.patients || []).map((p: any) => DataMapper.mapPatient(p))
    });
  }

  onPaymentPatientChange(): void {
    if (!this.selectedPatientId) {
      this.selectedPatientTotalDebt = 0;
      this.selectedPatientPaidAmount = 0;
      this.selectedPatientRemainingDebt = 0;
      this.approvedPlans = [];
      this.selectedApprovedPlanId = null;
      this.patientPayments = [];
      return;
    }

    this.paymentService.getPatientDebt(this.selectedPatientId).subscribe({
      next: res => {
        const debt = res.debt || {};
        this.selectedPatientTotalDebt = Number(debt.total_debt || debt.totalDebt || 0);
        this.selectedPatientPaidAmount = Number(debt.paid_amount || debt.paidAmount || 0);
        this.selectedPatientRemainingDebt = Number(debt.remaining_debt || debt.remainingDebt || 0);
      },
      error: (err) => {
        console.error('Error loading patient debt:', err);
        this.snackBar.open('Hasta borc bilgisi alinamadi', 'Kapat', { duration: 3000 });
      }
    });

    this.paymentService.getApprovedPlans(this.selectedPatientId).subscribe({
      next: res => {
        this.approvedPlans = res.plans || [];
      },
      error: () => {
        this.approvedPlans = [];
      }
    });

    this.paymentService.getPatientPayments(this.selectedPatientId).subscribe({
      next: res => {
        this.patientPayments = res.payments || [];
      },
      error: () => {
        this.patientPayments = [];
      }
    });
  }

  onApprovedPlanChange(): void {
    if (!this.selectedApprovedPlanId) return;
    const plan = this.approvedPlans.find(p => p.id === this.selectedApprovedPlanId);
    if (!plan) return;
    const total = this.resolvePlanTotal(plan);
    if (total > 0) {
      this.paymentAmount = total;
    }
  }

  processPayment(): void {
    if (!this.selectedPatientId || !this.paymentMethod || this.paymentAmount <= 0) return;

    this.paymentService.processPayment({
      patientId: this.selectedPatientId,
      amount: this.paymentAmount,
      paymentMethod: this.paymentMethod,
      treatmentPlanId: this.selectedApprovedPlanId,
      notes: null
    }).subscribe({
      next: (res) => {
        const dentistCommission = Number(res?.payment?.dentist_commission || 0);
        this.lastDentistCommission = dentistCommission;
        this.lastDentistCommissionRate = this.paymentAmount > 0 ? (dentistCommission / this.paymentAmount) * 100 : 0;

        this.snackBar.open('Odeme basariyla alindi', 'Kapat', { duration: 2500 });
        this.paymentAmount = 0;
        this.onPaymentPatientChange();
        this.loadIncomeExpense();
      },
      error: (err) => {
        console.error('Error processing payment:', err);
        this.snackBar.open('Odeme alinirken hata olustu', 'Kapat', { duration: 3000 });
      }
    });
  }

  formatDateTime(value: string): string {
    if (!value) return '-';
    return new Date(value).toLocaleString('tr-TR');
  }
}
