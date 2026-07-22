import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { AuthService } from '../../core/services/auth.service';
import { InstitutionAgreementService, InstitutionAgreement } from '../../core/services/institution-agreement.service';
import { PaymentService, PendingPlan, PatientDebt, PaymentRecord, FinancialTransaction } from '../../core/services/payment.service';
import { PatientService } from '../../core/services/patient.service';
import { DataMapper } from '../../core/utils/data-mapper';
import { Patient } from '../../core/models/models';

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
    MatProgressSpinnerModule,
    MatExpansionModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Ödeme ve İndirim Yönetimi</h1>
          <p class="page-subtitle">Tahsilat, tedavi planı onayı ve kurum anlaşmaları</p>
        </div>
      </div>

      <mat-tab-group animationDuration="150ms">
        <!-- Özet -->
        <mat-tab label="Özet">
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-icon tone-blue"><mat-icon>account_balance_wallet</mat-icon></div>
              <div>
                <div class="summary-label">Toplam Alacak</div>
                <div class="summary-value">{{ totalReceivables | number:'1.2-2' }} ₺</div>
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-icon tone-green"><mat-icon>payments</mat-icon></div>
              <div>
                <div class="summary-label">Toplam Gelir</div>
                <div class="summary-value">{{ totalIncome | number:'1.2-2' }} ₺</div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Onay Bekleyen İşlemler (yüksek indirim / iade talepleri) -->
        <mat-tab>
          <ng-template mat-tab-label>
            Onay Bekleyen İşlemler
            <span class="tab-badge" *ngIf="pendingApprovals.length > 0">{{ pendingApprovals.length }}</span>
          </ng-template>
          <div class="tab-content">
            <div *ngIf="loadingApprovals" class="loading"><mat-spinner diameter="36"></mat-spinner></div>
            <div *ngIf="!loadingApprovals && pendingApprovals.length === 0" class="empty-state">
              <mat-icon>task_alt</mat-icon>
              <div class="empty-title">Onay bekleyen indirim veya iade talebi yok</div>
            </div>
            <div class="approval-card" *ngFor="let approval of pendingApprovals">
              <div class="approval-top">
                <span class="chip" [class.chip-discount]="approval.transactionType === 'discount'" [class.chip-refund]="approval.transactionType === 'refund'">
                  {{ approval.transactionType === 'discount' ? 'Yüksek İndirim' : 'İade' }}
                </span>
                <strong class="approval-amount">{{ approval.amount | number:'1.2-2' }} ₺</strong>
              </div>
              <p class="approval-patient">{{ approval.patientName || ('Hasta #' + approval.patientId) }}</p>
              <p class="approval-reason" *ngIf="approval.reason"><em>"{{ approval.reason }}"</em></p>
              <p class="approval-meta">
                Talep eden: {{ approval.createdByName || approval.createdByEmail || '-' }} ·
                {{ approval.createdAt | date:'dd.MM.yyyy HH:mm' }}
              </p>
              <div class="approval-actions" *ngIf="isAdmin">
                <button mat-raised-button color="primary" [disabled]="processingApprovalId === approval.id"
                        (click)="approveTransaction(approval)">
                  <mat-icon>check</mat-icon> Onayla
                </button>
                <button mat-stroked-button color="warn" [disabled]="processingApprovalId === approval.id"
                        (click)="rejectTransaction(approval)">
                  <mat-icon>close</mat-icon> Reddet
                </button>
              </div>
              <p class="approval-note" *ngIf="!isAdmin">Onaylama/reddetme yetkisi yalnızca patrondadır.</p>
            </div>
          </div>
        </mat-tab>

        <!-- Tedavi Planı Onaylama -->
        <mat-tab label="Tedavi Planı Onaylama">
          <div class="tab-content">
            <div *ngIf="loadingPlans" class="loading"><mat-spinner diameter="36"></mat-spinner></div>
            <div *ngIf="!loadingPlans && pendingPlans.length === 0" class="empty-state">
              <mat-icon>fact_check</mat-icon>
              <div class="empty-title">Onay bekleyen tedavi planı yok</div>
            </div>
            <mat-accordion>
              <mat-expansion-panel *ngFor="let plan of pendingPlans">
                <mat-expansion-panel-header>
                  <mat-panel-title>{{ plan.patientName }} — {{ plan.title || ('Plan #' + plan.id) }}</mat-panel-title>
                  <mat-panel-description>
                    {{ planTotal(plan) | number:'1.2-2' }} ₺ · {{ plan.dentistName || plan.dentistEmail || '-' }}
                  </mat-panel-description>
                </mat-expansion-panel-header>
                <table mat-table [dataSource]="plan.items" class="plan-items-table" *ngIf="plan.items.length > 0">
                  <ng-container matColumnDef="treatmentType">
                    <th mat-header-cell *matHeaderCellDef>İşlem</th>
                    <td mat-cell *matCellDef="let item">{{ item.treatmentType || '-' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="toothNumber">
                    <th mat-header-cell *matHeaderCellDef>Diş</th>
                    <td mat-cell *matCellDef="let item">{{ item.toothNumber || '-' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="cost">
                    <th mat-header-cell *matHeaderCellDef>Tutar</th>
                    <td mat-cell *matCellDef="let item">{{ item.cost | number:'1.2-2' }} ₺</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="planItemColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: planItemColumns;"></tr>
                </table>
                <div class="plan-actions">
                  <button mat-raised-button color="primary" (click)="approvePlan(plan, true)">
                    <mat-icon>check</mat-icon> Onayla
                  </button>
                  <button mat-stroked-button color="warn" (click)="approvePlan(plan, false)">
                    <mat-icon>close</mat-icon> Reddet
                  </button>
                </div>
              </mat-expansion-panel>
            </mat-accordion>
          </div>
        </mat-tab>

        <!-- Ödeme İşleme -->
        <mat-tab label="Ödeme İşleme">
          <div class="payment-layout">
            <mat-card class="patient-search-card">
              <mat-card-header><mat-card-title>Hasta Seç</mat-card-title></mat-card-header>
              <mat-card-content>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Hasta ara</mat-label>
                  <input matInput [(ngModel)]="patientSearch" (input)="searchPatients()"
                         placeholder="Ad, soyad veya telefon">
                  <mat-icon matSuffix>search</mat-icon>
                </mat-form-field>
                <mat-list>
                  <mat-list-item *ngFor="let p of patientResults"
                                 (click)="selectPatient(p)"
                                 [class.selected]="selectedPatient?.id === p.id"
                                 class="patient-item">
                    {{ p.firstName }} {{ p.lastName }}
                  </mat-list-item>
                </mat-list>
              </mat-card-content>
            </mat-card>

            <div class="payment-detail" *ngIf="selectedPatient">
              <mat-card class="debt-card">
                <mat-card-header>
                  <mat-card-title>{{ selectedPatient.firstName }} {{ selectedPatient.lastName }}</mat-card-title>
                </mat-card-header>
                <mat-card-content *ngIf="patientDebt">
                  <div class="debt-row"><span>Toplam Borç:</span><strong>{{ patientDebt.totalDebt | number:'1.2-2' }} ₺</strong></div>
                  <div class="debt-row"><span>Ödenen:</span><strong>{{ patientDebt.paidAmount | number:'1.2-2' }} ₺</strong></div>
                  <div class="debt-row remaining"><span>Kalan Borç:</span><strong>{{ patientDebt.remainingDebt | number:'1.2-2' }} ₺</strong></div>
                </mat-card-content>
              </mat-card>

              <mat-card class="payment-form-card">
                <mat-card-header><mat-card-title>Tahsilat</mat-card-title></mat-card-header>
                <mat-card-content>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Tutar (₺)</mat-label>
                    <input matInput type="number" min="0" [(ngModel)]="paymentAmount">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Ödeme Yöntemi</mat-label>
                    <mat-select [(ngModel)]="paymentMethod">
                      <mat-option value="cash">Nakit</mat-option>
                      <mat-option value="card">Kart</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Not (opsiyonel)</mat-label>
                    <input matInput [(ngModel)]="paymentNotes">
                  </mat-form-field>
                  <button mat-raised-button color="primary" class="full-width"
                          [disabled]="processing || !paymentAmount || paymentAmount <= 0"
                          (click)="processPayment()">
                    <mat-icon>point_of_sale</mat-icon> Ödemeyi Al
                  </button>
                </mat-card-content>
              </mat-card>

              <mat-card class="history-card" *ngIf="patientPayments.length > 0">
                <mat-card-header><mat-card-title>Ödeme Geçmişi</mat-card-title></mat-card-header>
                <mat-card-content>
                  <table mat-table [dataSource]="patientPayments">
                    <ng-container matColumnDef="createdAt">
                      <th mat-header-cell *matHeaderCellDef>Tarih</th>
                      <td mat-cell *matCellDef="let pay">{{ pay.createdAt | date:'dd.MM.yyyy HH:mm' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="amount">
                      <th mat-header-cell *matHeaderCellDef>Tutar</th>
                      <td mat-cell *matCellDef="let pay">{{ pay.amount | number:'1.2-2' }} ₺</td>
                    </ng-container>
                    <ng-container matColumnDef="paymentMethod">
                      <th mat-header-cell *matHeaderCellDef>Yöntem</th>
                      <td mat-cell *matCellDef="let pay">{{ pay.paymentMethod === 'cash' ? 'Nakit' : 'Kart' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let pay">
                        <button mat-button color="warn" (click)="startRefund(pay)">
                          <mat-icon>undo</mat-icon> İade
                        </button>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="paymentColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: paymentColumns;"></tr>
                  </table>

                  <div class="refund-form" *ngIf="refundingPayment">
                    <h4>{{ refundingPayment.amount | number:'1.2-2' }} ₺ tutarındaki ödemeyi iade et</h4>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>İade Tutarı (boş = tamamı)</mat-label>
                      <input matInput type="number" min="0" [(ngModel)]="refundAmount">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Gerekçe</mat-label>
                      <input matInput [(ngModel)]="refundReason" required>
                    </mat-form-field>
                    <p class="approval-note" *ngIf="!isAdmin">Sekreter olarak gönderdiğiniz iade, patron onayından geçtikten sonra uygulanır.</p>
                    <div class="agreement-actions">
                      <button mat-button (click)="cancelRefund()">Vazgeç</button>
                      <button mat-raised-button color="warn" [disabled]="submittingRefund || !refundReason.trim()"
                              (click)="submitRefund()">
                        <mat-spinner *ngIf="submittingRefund" diameter="18" class="inline-spinner"></mat-spinner>
                        <span *ngIf="!submittingRefund">İadeyi Gönder</span>
                      </button>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Anlaşmalı Kurumlar -->
        <mat-tab label="Anlaşmalı Kurumlar">
          <div class="agreements-layout">
            <mat-card class="agreements-list">
              <mat-card-header>
                <mat-card-title>Kurumlar</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <mat-list>
                  <mat-list-item *ngFor="let agreement of agreements"
                                 (click)="selectAgreement(agreement)"
                                 [class.selected]="selectedAgreement?.id === agreement.id">
                    {{ agreement.institution_name }}
                  </mat-list-item>
                </mat-list>
              </mat-card-content>
            </mat-card>

            <mat-card class="agreement-details" *ngIf="selectedAgreement">
              <mat-card-header>
                <mat-card-title>{{ selectedAgreement.institution_name }}</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="agreement-info" *ngIf="!editMode">
                  <p><strong>İletişim Kişisi:</strong> {{ selectedAgreement.contact_person || '-' }}</p>
                  <p><strong>Telefon:</strong> {{ selectedAgreement.contact_phone || '-' }}</p>
                  <p><strong>E-posta:</strong> {{ selectedAgreement.contact_email || '-' }}</p>
                  <p><strong>Genel İndirim:</strong> {{ selectedAgreement.discount_percentage }}%</p>
                  <div class="category-discounts" *ngIf="selectedAgreement.category_discounts && (selectedAgreement.category_discounts | keyvalue)!.length">
                    <strong>Kategori Bazlı İndirimler:</strong>
                    <ul>
                      <li *ngFor="let cat of selectedAgreement.category_discounts | keyvalue">
                        {{ cat.key }}: %{{ cat.value }}
                      </li>
                    </ul>
                    <p class="category-note">Bir tedavi kategorisi burada listelenmiyorsa genel indirim oranı uygulanır.</p>
                  </div>
                  <p *ngIf="selectedAgreement.notes"><strong>Notlar:</strong> {{ selectedAgreement.notes }}</p>
                </div>

                <div class="agreement-actions" *ngIf="canEdit && !editMode">
                  <button mat-raised-button color="primary" (click)="editAgreement()">
                    Düzenle
                  </button>
                </div>

                <form class="agreement-edit-form" *ngIf="editMode">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Kurum Adı</mat-label>
                    <input matInput [(ngModel)]="editForm.institution_name" name="institution_name" required>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>İletişim Kişisi</mat-label>
                    <input matInput [(ngModel)]="editForm.contact_person" name="contact_person">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Telefon</mat-label>
                    <input matInput [(ngModel)]="editForm.contact_phone" name="contact_phone">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>E-posta</mat-label>
                    <input matInput type="email" [(ngModel)]="editForm.contact_email" name="contact_email">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Genel İndirim (%)</mat-label>
                    <input matInput type="number" min="0" max="100" [(ngModel)]="editForm.discount_percentage" name="discount_percentage">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Notlar</mat-label>
                    <textarea matInput rows="2" [(ngModel)]="editForm.notes" name="notes"></textarea>
                  </mat-form-field>
                  <div class="agreement-actions">
                    <button mat-button type="button" (click)="cancelAgreementEdit()">Vazgeç</button>
                    <button mat-raised-button color="primary" type="button" (click)="saveAgreementEdit()"
                            [disabled]="!editForm.institution_name || savingAgreement">
                      <mat-spinner *ngIf="savingAgreement" diameter="18" class="inline-spinner"></mat-spinner>
                      <span *ngIf="!savingAgreement">Kaydet</span>
                    </button>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px; }
    ::ng-deep .mat-mdc-tab-body-wrapper { padding-top: 4px; }
    .tab-content {
      padding: 20px 4px;
    }
    .loading {
      display: flex;
      justify-content: center;
      padding: 24px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }
    .summary-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      border: 1px solid rgba(15, 23, 42, 0.04);
      padding: 18px 20px;
    }
    .summary-icon {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .summary-icon.tone-blue { background: var(--bulka-primary-50, #f0fdfa); color: var(--bulka-primary-700, #0f766e); }
    .summary-icon.tone-green { background: var(--success-50); color: var(--success-600); }
    .summary-label {
      color: var(--ink-500);
      font-size: 13px;
    }
    .summary-value {
      font-size: 22px;
      font-weight: 700;
      color: var(--ink-900);
    }
    .plan-items-table {
      width: 100%;
      margin-bottom: 12px;
    }
    .plan-actions {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }
    .payment-layout {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 20px;
      margin-top: 20px;
      align-items: start;
    }
    .payment-detail {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .full-width {
      width: 100%;
    }
    .patient-item {
      cursor: pointer;
      border-radius: var(--radius-sm);
    }
    .patient-item:hover {
      background-color: var(--surface-muted);
    }
    .debt-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
    }
    .debt-row.remaining strong {
      color: var(--warn-600);
      font-size: 18px;
    }
    .agreements-layout {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 20px;
      margin-top: 20px;
      align-items: start;
    }
    .agreements-list mat-list-item {
      cursor: pointer;
      border-radius: var(--radius-sm);
    }
    .agreements-list mat-list-item:hover {
      background-color: var(--surface-muted);
    }
    .selected {
      background-color: var(--bulka-primary-50, #f0fdfa) !important;
    }
    .agreement-info p {
      margin: 8px 0;
    }
    .category-discounts {
      margin: 8px 0;
      padding: 10px 14px;
      background: var(--surface-muted);
      border-radius: var(--radius-sm, 8px);
    }
    .category-discounts ul {
      margin: 6px 0 0;
      padding-left: 18px;
    }
    .category-note {
      margin: 8px 0 0;
      font-size: 12px;
      color: var(--ink-500);
    }
    .agreement-actions {
      margin-top: 20px;
      display: flex;
      gap: 12px;
    }
    .agreement-edit-form .full-width {
      width: 100%;
      margin-bottom: 4px;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    .tab-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      margin-left: 8px;
      border-radius: 999px;
      background: var(--coral-500, #f43f5e);
      color: white;
      font-size: 11px;
      font-weight: 700;
    }
    .approval-card {
      background: var(--surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      border: 1px solid rgba(15, 23, 42, 0.04);
      padding: 16px 20px;
      margin-bottom: 14px;
    }
    .approval-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }
    .chip {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: uppercase;
    }
    .chip-discount { background: var(--bulka-primary-50, #f0fdfa); color: var(--bulka-primary-700, #0f766e); }
    .chip-refund { background: var(--amber-50); color: var(--amber-600); }
    .approval-amount {
      font-size: 18px;
      color: var(--ink-900);
    }
    .approval-patient {
      font-weight: 600;
      margin: 4px 0;
    }
    .approval-reason {
      color: var(--ink-500);
      margin: 4px 0;
    }
    .approval-meta {
      font-size: 12px;
      color: var(--ink-500);
      margin: 4px 0 12px;
    }
    .approval-actions {
      display: flex;
      gap: 12px;
    }
    .approval-note {
      font-size: 12px;
      color: var(--ink-500);
      font-style: italic;
    }
    .refund-form {
      margin-top: 16px;
      padding: 16px;
      background: var(--surface-muted);
      border-radius: var(--radius-md, 12px);
    }
    .refund-form h4 {
      margin: 0 0 12px;
    }
  `]
})
export class PaymentsComponent implements OnInit {
  // Kurum anlaşmaları
  agreements: InstitutionAgreement[] = [];
  selectedAgreement: InstitutionAgreement | null = null;
  isAdmin = false;
  isSecretary = false;
  canEdit = false;
  editMode = false;
  savingAgreement = false;
  editForm: Partial<InstitutionAgreement> = {};

  // Özet
  totalReceivables = 0;
  totalIncome = 0;

  // Bekleyen planlar
  pendingPlans: PendingPlan[] = [];
  loadingPlans = false;
  planItemColumns = ['treatmentType', 'toothNumber', 'cost'];

  // Onay bekleyen yüksek indirim / iade talepleri
  pendingApprovals: FinancialTransaction[] = [];
  loadingApprovals = false;
  processingApprovalId: number | null = null;

  // İade formu
  refundingPayment: PaymentRecord | null = null;
  refundAmount: number | null = null;
  refundReason = '';
  submittingRefund = false;

  // Ödeme işleme
  patientSearch = '';
  patientResults: Patient[] = [];
  selectedPatient: Patient | null = null;
  patientDebt: PatientDebt | null = null;
  patientPayments: PaymentRecord[] = [];
  paymentColumns = ['createdAt', 'amount', 'paymentMethod', 'actions'];
  paymentAmount: number | null = null;
  paymentMethod: 'card' | 'cash' = 'cash';
  paymentNotes = '';
  processing = false;

  private searchTimer?: ReturnType<typeof setTimeout>;

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
        this.canEdit = this.isAdmin; // Only admin can edit
      }
    });
  }

  ngOnInit(): void {
    this.loadAgreements();
    this.loadSummary();
    this.loadPendingPlans();
    this.loadPendingApprovals();
  }

  // --- Onay bekleyen indirim/iade talepleri ---
  loadPendingApprovals(): void {
    this.loadingApprovals = true;
    this.paymentService.getPendingApprovals().subscribe({
      next: approvals => {
        this.pendingApprovals = approvals;
        this.loadingApprovals = false;
      },
      error: () => {
        this.loadingApprovals = false;
        this.snackBar.open('Onay bekleyen işlemler yüklenirken hata oluştu', 'Kapat', { duration: 3000 });
      }
    });
  }

  approveTransaction(approval: FinancialTransaction): void {
    this.processingApprovalId = approval.id;
    this.paymentService.approveTransaction(approval.id).subscribe({
      next: () => {
        this.processingApprovalId = null;
        this.snackBar.open('Talep onaylandı ve uygulandı', 'Kapat', { duration: 3000 });
        this.loadPendingApprovals();
        this.loadSummary();
        if (this.selectedPatient?.id === approval.patientId) {
          this.refreshPatientFinancials();
        }
      },
      error: (error) => {
        this.processingApprovalId = null;
        this.snackBar.open(error.error?.message || 'Onaylama başarısız oldu', 'Kapat', { duration: 4000 });
      }
    });
  }

  rejectTransaction(approval: FinancialTransaction): void {
    this.processingApprovalId = approval.id;
    this.paymentService.rejectTransaction(approval.id).subscribe({
      next: () => {
        this.processingApprovalId = null;
        this.snackBar.open('Talep reddedildi', 'Kapat', { duration: 3000 });
        this.loadPendingApprovals();
      },
      error: (error) => {
        this.processingApprovalId = null;
        this.snackBar.open(error.error?.message || 'Reddetme başarısız oldu', 'Kapat', { duration: 4000 });
      }
    });
  }

  // --- Ödeme iadesi ---
  startRefund(payment: PaymentRecord): void {
    this.refundingPayment = payment;
    this.refundAmount = null;
    this.refundReason = '';
  }

  cancelRefund(): void {
    this.refundingPayment = null;
  }

  submitRefund(): void {
    if (!this.refundingPayment || !this.refundReason.trim()) return;
    this.submittingRefund = true;
    const paymentId = this.refundingPayment.id;
    this.paymentService.refundPayment(paymentId, {
      amount: this.refundAmount ?? undefined,
      reason: this.refundReason.trim()
    }).subscribe({
      next: (res) => {
        this.submittingRefund = false;
        this.refundingPayment = null;
        this.snackBar.open(
          res.pending ? 'İade talebi patron onayına gönderildi' : 'İade işlendi',
          'Kapat',
          { duration: 3000 }
        );
        this.refreshPatientFinancials();
        this.loadPendingApprovals();
        this.loadSummary();
      },
      error: (error) => {
        this.submittingRefund = false;
        this.snackBar.open(error.error?.message || 'İade işlenemedi', 'Kapat', { duration: 4000 });
      }
    });
  }

  // --- Özet ---
  loadSummary(): void {
    this.paymentService.getTotalReceivables().subscribe({
      next: total => (this.totalReceivables = total),
      error: () => (this.totalReceivables = 0)
    });
    this.paymentService.getTotalIncome().subscribe({
      next: total => (this.totalIncome = total),
      error: () => (this.totalIncome = 0)
    });
  }

  // --- Bekleyen planlar ---
  loadPendingPlans(): void {
    this.loadingPlans = true;
    this.paymentService.getPendingPlans().subscribe({
      next: plans => {
        this.pendingPlans = plans;
        this.loadingPlans = false;
      },
      error: () => {
        this.loadingPlans = false;
        this.snackBar.open('Bekleyen planlar yüklenirken hata oluştu', 'Kapat', { duration: 3000 });
      }
    });
  }

  planTotal(plan: PendingPlan): number {
    return plan.items.length > 0
      ? plan.items.reduce((sum, i) => sum + i.cost, 0)
      : plan.totalEstimatedCost;
  }

  approvePlan(plan: PendingPlan, approved: boolean): void {
    this.paymentService.approvePlan(plan.id, approved).subscribe({
      next: () => {
        this.snackBar.open(
          approved ? 'Tedavi planı onaylandı' : 'Tedavi planı reddedildi',
          'Kapat',
          { duration: 3000 }
        );
        this.loadPendingPlans();
        this.loadSummary();
        // Seçili hastanın borcu değişmiş olabilir
        if (this.selectedPatient?.id === plan.patientId) {
          this.refreshPatientFinancials();
        }
      },
      error: () => this.snackBar.open('İşlem başarısız oldu', 'Kapat', { duration: 3000 })
    });
  }

  // --- Ödeme işleme ---
  searchPatients(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      const term = this.patientSearch.trim();
      if (term.length < 2) {
        this.patientResults = [];
        return;
      }
      this.patientService.getPatients(1, 10, term).subscribe({
        next: res => {
          const raw = (res as any).patients ?? (res as any).data ?? [];
          this.patientResults = raw.map((p: any) => DataMapper.mapPatient(p));
        },
        error: () => (this.patientResults = [])
      });
    }, 300);
  }

  selectPatient(patient: Patient): void {
    this.selectedPatient = patient;
    this.paymentAmount = null;
    this.paymentNotes = '';
    this.refreshPatientFinancials();
  }

  private refreshPatientFinancials(): void {
    if (!this.selectedPatient) return;
    const id = this.selectedPatient.id;
    this.paymentService.getPatientDebt(id).subscribe({
      next: debt => (this.patientDebt = debt),
      error: () => (this.patientDebt = null)
    });
    this.paymentService.getPatientPayments(id).subscribe({
      next: payments => (this.patientPayments = payments),
      error: () => (this.patientPayments = [])
    });
  }

  processPayment(): void {
    if (!this.selectedPatient || !this.paymentAmount || this.paymentAmount <= 0) return;
    this.processing = true;
    this.paymentService.processPayment({
      patientId: this.selectedPatient.id,
      amount: this.paymentAmount,
      paymentMethod: this.paymentMethod,
      notes: this.paymentNotes || undefined
    }).subscribe({
      next: () => {
        this.processing = false;
        this.snackBar.open('Ödeme başarıyla alındı', 'Kapat', { duration: 3000 });
        this.paymentAmount = null;
        this.paymentNotes = '';
        this.refreshPatientFinancials();
        this.loadSummary();
      },
      error: () => {
        this.processing = false;
        this.snackBar.open('Ödeme işlenemedi', 'Kapat', { duration: 3000 });
      }
    });
  }

  // --- Kurum anlaşmaları ---
  loadAgreements(): void {
    this.agreementService.getAgreements().subscribe({
      next: (agreements) => {
        this.agreements = agreements;
      },
      error: (error) => {
        console.error('Error loading agreements:', error);
        this.snackBar.open('Anlaşmalar yüklenirken hata oluştu', 'Kapat', { duration: 3000 });
      }
    });
  }

  selectAgreement(agreement: InstitutionAgreement): void {
    this.selectedAgreement = agreement;
    this.editMode = false;
  }

  editAgreement(): void {
    if (!this.selectedAgreement) return;
    this.editForm = { ...this.selectedAgreement };
    this.editMode = true;
  }

  cancelAgreementEdit(): void {
    this.editMode = false;
  }

  saveAgreementEdit(): void {
    if (!this.selectedAgreement || !this.editForm.institution_name) return;
    this.savingAgreement = true;
    this.agreementService.updateAgreement(this.selectedAgreement.id, this.editForm).subscribe({
      next: (updated) => {
        this.selectedAgreement = updated;
        this.agreements = this.agreements.map(a => a.id === updated.id ? updated : a);
        this.editMode = false;
        this.savingAgreement = false;
        this.snackBar.open('Kurum anlaşması güncellendi', 'Kapat', { duration: 3000 });
      },
      error: (error) => {
        const errorMessage = error.error?.message || 'Anlaşma güncellenirken hata oluştu';
        this.snackBar.open(errorMessage, 'Kapat', { duration: 5000 });
        this.savingAgreement = false;
      }
    });
  }
}
