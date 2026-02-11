import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { TreatmentService } from '../../../core/services/treatment.service';
import { PatientService } from '../../../core/services/patient.service';
import { AuthService } from '../../../core/services/auth.service';
import { Treatment, Patient, TariffItem, TreatmentPlanItem } from '../../../core/models/models';
import { DataMapper } from '../../../core/utils/data-mapper';
import { ToothChartComponent } from '../tooth-chart/tooth-chart.component';
import { TariffSelectorComponent } from '../tariff-selector/tariff-selector.component';

@Component({
  selector: 'app-treatment-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    MatExpansionModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    ToothChartComponent,
    TariffSelectorComponent
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Tedavi Düzenle' : (isPlanMode ? 'Yeni Tedavi Planı' : 'Yeni Tedavi') }}</h2>
    <mat-dialog-content class="treatment-form-content">
      <mat-tab-group [(selectedIndex)]="activeTab">
        <mat-tab label="Bilgiler">
          <form [formGroup]="treatmentForm" class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Hasta</mat-label>
              <mat-select formControlName="patientId" required>
                <mat-option *ngFor="let patient of patients" [value]="patient.id">
                  {{ patient.firstName }} {{ patient.lastName }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Tedavi Tarihi</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="treatmentDate" required>
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" *ngIf="!isPlanMode">
              <mat-label>Tedavi Tipi</mat-label>
              <input matInput formControlName="treatmentType" [required]="!isPlanMode">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" *ngIf="!isPlanMode">
              <mat-label>Diş Numarası</mat-label>
              <input matInput formControlName="toothNumber" placeholder="Örn: 11, 12">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" *ngIf="!isPlanMode">
              <mat-label>Durum</mat-label>
              <mat-select formControlName="status">
                <mat-option value="planned">Planlandı</mat-option>
                <mat-option value="in_progress">Devam Ediyor</mat-option>
                <mat-option value="completed">Tamamlandı</mat-option>
                <mat-option value="cancelled">İptal Edildi</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" *ngIf="canViewPrices && !isPlanMode">
              <mat-label>Ücret</mat-label>
              <input matInput type="number" formControlName="cost" step="0.01">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Tanı / Plan Başlığı</mat-label>
              <textarea matInput formControlName="diagnosis" rows="2"></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Prosedür Notları / Açıklama</mat-label>
              <textarea matInput formControlName="procedureNotes" rows="3"></textarea>
            </mat-form-field>
          </form>
        </mat-tab>

        <mat-tab label="Diş Seçimi & Tarife">
          <div class="planning-container">
            <app-tooth-chart 
              [selectedTeeth]="selectedTeeth" 
              (teethChanged)="onTeethChanged($event)">
            </app-tooth-chart>

            <mat-divider></mat-divider>

            <div class="planning-section" *ngIf="selectedTeeth.length > 0">
              <h3>İşlem Ekle (Seçili Dişler: {{ selectedTeeth.join(', ') }})</h3>
              <app-tariff-selector (itemSelected)="onProcedureSelected($event)"></app-tariff-selector>
            </div>

            <div class="planned-items-section" *ngIf="plannedProcedures.length > 0">
              <h3>Planlanan İşlemler</h3>
              <div class="planned-items-list">
                <div *ngFor="let plan of plannedProcedures; let i = index" class="planned-item">
                  <div class="planned-item-info">
                    <strong>Diş {{ plan.toothNumber }}:</strong> {{ plan.treatmentType }}
                    <span *ngIf="canViewPrices" class="price">₺{{ plan.cost }}</span>
                  </div>
                  <button mat-icon-button color="warn" (click)="removePlannedItem(i)">
                    <mat-icon>remove_circle</mat-icon>
                  </button>
                </div>
              </div>
              <div class="total-cost" *ngIf="canViewPrices && totalCost > 0">
                Toplam: ₺{{ totalCost.toLocaleString('tr-TR') }}
              </div>
            </div>
            
            <div class="no-selection-hint" *ngIf="selectedTeeth.length === 0">
              İşlem eklemek için lütfen yukarıdaki şemadan diş seçin.
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions>
      <div class="mode-toggle">
        <button mat-button (click)="isPlanMode = !isPlanMode" *ngIf="!data">
          {{ isPlanMode ? 'Tekli Tedaviye Geç' : 'Randevu Planına Geç' }}
        </button>
      </div>
      <button mat-button (click)="onCancel()">İptal</button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!isFormValid() || isLoading">
        <mat-spinner *ngIf="isLoading" diameter="20" class="inline-spinner"></mat-spinner>
        <span *ngIf="!isLoading">Kaydet</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .treatment-form-content {
      min-width: 800px;
      max-height: 85vh;
      overflow-y: auto;
    }
    .form-grid {
      padding-top: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 20px;
    }
    .full-width {
      grid-column: span 2;
    }
    .planning-container {
      padding: 16px 0;
    }
    .planning-section {
      margin-top: 20px;
    }
    .planned-items-section {
      margin-top: 24px;
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
    }
    .planned-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: white;
      margin-bottom: 8px;
      border-radius: 4px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .price {
      margin-left: 8px;
      color: #10b981;
      font-weight: 500;
    }
    .total-cost {
      text-align: right;
      font-size: 1.1rem;
      font-weight: bold;
      margin-top: 12px;
      color: #1e40af;
    }
    .no-selection-hint {
      padding: 40px;
      text-align: center;
      color: #64748b;
      font-style: italic;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    .mode-toggle {
      flex: 1;
    }
  `]
})
export class TreatmentFormDialogComponent implements OnInit {
  treatmentForm: FormGroup;
  patients: Patient[] = [];
  isLoading = false;
  canViewPrices = false;
  private currentUser: any = null;

  // Advanced features
  activeTab = 0;
  isPlanMode = false;
  selectedTeeth: number[] = [];
  plannedProcedures: TreatmentPlanItem[] = [];
  totalCost = 0;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TreatmentFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Treatment | null,
    private treatmentService: TreatmentService,
    private patientService: PatientService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = user;
        this.canViewPrices = user.roles.includes('admin') || user.roles.includes('secretary');
      }
    });

    this.treatmentForm = this.fb.group({
      patientId: ['', Validators.required],
      treatmentDate: [new Date(), Validators.required],
      treatmentType: [''],
      toothNumber: [''],
      status: ['planned'],
      cost: [null],
      diagnosis: [''],
      procedureNotes: ['']
    });
  }

  ngOnInit(): void {
    this.loadPatients();

    if (this.data) {
      const mapped = DataMapper.mapTreatment(this.data);
      const date = new Date(mapped.treatmentDate || mapped.treatment_date || '');

      this.treatmentForm.patchValue({
        patientId: mapped.patientId || mapped.patient_id,
        treatmentDate: date,
        treatmentType: mapped.treatmentType || mapped.treatment_type,
        toothNumber: mapped.toothNumber || mapped.tooth_number || '',
        status: mapped.status || 'planned',
        cost: mapped.cost,
        diagnosis: mapped.diagnosis || '',
        procedureNotes: mapped.procedureNotes || mapped.procedure_notes || ''
      });

      if (mapped.toothNumber) {
        this.selectedTeeth = mapped.toothNumber.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
      }
    }
  }

  loadPatients(): void {
    this.patientService.getPatients(1, 1000).subscribe({
      next: (response) => {
        this.patients = response.patients || [];
      }
    });
  }

  onTeethChanged(teeth: number[]) {
    this.selectedTeeth = teeth;
    if (!this.isPlanMode) {
      this.treatmentForm.patchValue({ toothNumber: teeth.join(', ') });
    }
  }

  onProcedureSelected(item: TariffItem) {
    if (this.isPlanMode) {
      this.selectedTeeth.forEach(tooth => {
        this.plannedProcedures.push({
          toothNumber: tooth,
          treatmentType: item.name,
          cost: item.priceInclVat || item.price_incl_vat || 0,
          currency: item.currency || 'TRY',
          notes: `Kod: ${item.code}`
        });
      });
    } else {
      this.treatmentForm.patchValue({
        treatmentType: item.name,
        cost: item.priceInclVat || item.price_incl_vat || 0,
        procedureNotes: (this.treatmentForm.value.procedureNotes || '') + `\nKod: ${item.code}`
      });
      this.activeTab = 0; // Go back to info tab
    }
    this.calculateTotal();
  }

  removePlannedItem(index: number) {
    this.plannedProcedures.splice(index, 1);
    this.calculateTotal();
  }

  calculateTotal() {
    this.totalCost = this.plannedProcedures.reduce((acc, curr) => acc + (curr.cost || 0), 0);
  }

  isFormValid(): boolean {
    if (this.plannedProcedures.length > 0 || this.isPlanMode) {
      return !!this.treatmentForm.get('patientId')?.valid && this.plannedProcedures.length > 0;
    }
    return this.treatmentForm.valid;
  }

  onSave(): void {
    if (this.isFormValid()) {
      this.isLoading = true;
      const formValue = this.treatmentForm.value;

      if (this.plannedProcedures.length > 0 || this.isPlanMode) {
        const planRequest = {
          patientId: formValue.patientId,
          dentistId: this.currentUser?.roles?.includes('dentist') ? this.currentUser.id : null,
          title: formValue.diagnosis || `Tedavi Planı - ${new Date().toLocaleDateString('tr-TR')}`,
          description: formValue.procedureNotes || '',
          items: this.plannedProcedures
        };

        this.treatmentService.createTreatmentPlan(planRequest).subscribe({
          next: () => {
            this.snackBar.open('Tedavi planı başarıyla oluşturuldu', 'Kapat', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (err) => this.handleError(err)
        });
      } else {
        const treatmentData: Partial<Treatment> = {
          patientId: formValue.patientId,
          treatmentDate: formValue.treatmentDate.toISOString().split('T')[0],
          treatmentType: formValue.treatmentType,
          toothNumber: formValue.toothNumber || null,
          status: formValue.status || 'planned',
          diagnosis: formValue.diagnosis || null,
          procedureNotes: formValue.procedureNotes || null,
          currency: 'TRY'
        };

        if (this.canViewPrices && formValue.cost) {
          treatmentData.cost = formValue.cost;
        }

        const backendData = DataMapper.mapTreatmentToBackend(treatmentData);
        const request = this.data
          ? this.treatmentService.updateTreatment(this.data.id, backendData)
          : this.treatmentService.createTreatment(backendData);

        request.subscribe({
          next: () => this.dialogRef.close(true),
          error: (err) => this.handleError(err)
        });
      }
    }
  }

  private handleError(error: any) {
    console.error('Error saving:', error);
    const errorMessage = error.error?.message || 'Kaydedilirken hata oluştu';
    this.snackBar.open(errorMessage, 'Kapat', { duration: 5000 });
    this.isLoading = false;
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
