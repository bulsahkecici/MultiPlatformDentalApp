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
import { PaymentService, PendingPlan, PatientDebt, PaymentRecord } from '../../core/services/payment.service';
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
    <div class="payments-container">
      <h1>Ödeme ve İndirim Yönetimi</h1>

      <mat-tab-group>
        <!-- Özet -->
        <mat-tab label="Özet">
          <div class="summary-cards">
            <mat-card class="summary-card">
              <mat-card-content>
                <mat-icon color="warn">account_balance_wallet</mat-icon>
                <div>
                  <div class="summary-label">Toplam Alacak</div>
                  <div class="summary-value">{{ totalReceivables | number:'1.2-2' }} ₺</div>
                </div>
              </mat-card-content>
            </mat-card>
            <mat-card class="summary-card">
              <mat-card-content>
                <mat-icon color="primary">payments</mat-icon>
                <div>
                  <div class="summary-label">Toplam Gelir</div>
                  <div class="summary-value">{{ totalIncome | number:'1.2-2' }} ₺</div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Tedavi Planı Onaylama -->
        <mat-tab label="Tedavi Planı Onaylama">
          <div class="tab-content">
            <div *ngIf="loadingPlans" class="loading"><mat-spinner diameter="36"></mat-spinner></div>
            <p *ngIf="!loadingPlans && pendingPlans.length === 0" class="empty-text">
              Onay bekleyen tedavi planı yok.
            </p>
            <mat-accordion>
              <mat-expansion-panel *ngFor="let plan of pendingPlans">
                <mat-expansion-panel-header>
                  <mat-panel-title>{{ plan.patientName }} — {{ plan.title || ('Plan #' + plan.id) }}</mat-panel-title>
                  <mat-panel-description>
                    {{ planTotal(plan) | number:'1.2-2' }} ₺ · {{ plan.dentistEmail || '-' }}
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
                    <tr mat-header-row *matHeaderRowDef="paymentColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: paymentColumns;"></tr>
                  </table>
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
                <div class="agreement-info">
                  <p><strong>İletişim Kişisi:</strong> {{ selectedAgreement.contact_person || '-' }}</p>
                  <p><strong>Telefon:</strong> {{ selectedAgreement.contact_phone || '-' }}</p>
                  <p><strong>E-posta:</strong> {{ selectedAgreement.contact_email || '-' }}</p>
                  <p><strong>Genel İndirim:</strong> {{ selectedAgreement.discount_percentage }}%</p>
                  <p *ngIf="selectedAgreement.notes"><strong>Notlar:</strong> {{ selectedAgreement.notes }}</p>
                </div>

                <div class="agreement-actions" *ngIf="canEdit">
                  <button mat-raised-button color="primary" (click)="editAgreement()">
                    Düzenle
                  </button>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .payments-container {
      padding: 20px;
    }
    .tab-content {
      padding: 20px 0;
    }
    .loading {
      display: flex;
      justify-content: center;
      padding: 24px;
    }
    .empty-text {
      color: rgba(0,0,0,0.54);
      padding: 16px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .summary-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
    }
    .summary-card mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }
    .summary-label {
      color: rgba(0,0,0,0.54);
      font-size: 13px;
    }
    .summary-value {
      font-size: 24px;
      font-weight: bold;
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
    }
    .payment-detail {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .full-width {
      width: 100%;
    }
    .patient-item {
      cursor: pointer;
    }
    .patient-item:hover {
      background-color: #f5f5f5;
    }
    .debt-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
    }
    .debt-row.remaining strong {
      color: #d32f2f;
      font-size: 18px;
    }
    .agreements-layout {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    .agreements-list mat-list-item {
      cursor: pointer;
    }
    .agreements-list mat-list-item:hover {
      background-color: #f5f5f5;
    }
    .selected {
      background-color: #E6F2FF !important;
    }
    .agreement-info p {
      margin: 8px 0;
    }
    .agreement-actions {
      margin-top: 20px;
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

  // Özet
  totalReceivables = 0;
  totalIncome = 0;

  // Bekleyen planlar
  pendingPlans: PendingPlan[] = [];
  loadingPlans = false;
  planItemColumns = ['treatmentType', 'toothNumber', 'cost'];

  // Ödeme işleme
  patientSearch = '';
  patientResults: Patient[] = [];
  selectedPatient: Patient | null = null;
  patientDebt: PatientDebt | null = null;
  patientPayments: PaymentRecord[] = [];
  paymentColumns = ['createdAt', 'amount', 'paymentMethod'];
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
  }

  editAgreement(): void {
    // TODO: Open edit dialog
    this.snackBar.open('Düzenleme özelliği yakında eklenecek', 'Kapat', { duration: 3000 });
  }
}
