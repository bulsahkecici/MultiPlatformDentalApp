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
import { AuthService } from '../../core/services/auth.service';
import { InstitutionAgreementService, InstitutionAgreement } from '../../core/services/institution-agreement.service';


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
    MatListModule
  ],
  template: `
    <div class="payments-container">
      <h1>Ödeme ve İndirim Yönetimi</h1>

      <mat-tab-group>
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

        <!-- Tedavi Planı Onaylama (Sadece Secretary) -->
        <mat-tab label="Tedavi Planı Onaylama" *ngIf="isSecretary">
          <mat-card>
            <mat-card-content>
              <p>Tedavi planı onaylama bölümü</p>
              <!-- TODO: Implement treatment plan approval -->
            </mat-card-content>
          </mat-card>
        </mat-tab>

        <!-- Ödeme İşleme -->
        <mat-tab label="Ödeme İşleme">
          <mat-card>
            <mat-card-content>
              <p>Ödeme işleme bölümü</p>
              <!-- TODO: Implement payment processing -->
            </mat-card-content>
          </mat-card>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .payments-container {
      padding: 20px;
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
  agreements: InstitutionAgreement[] = [];
  selectedAgreement: InstitutionAgreement | null = null;
  isAdmin = false;
  isSecretary = false;
  canEdit = false;

  constructor(
    private authService: AuthService,
    private agreementService: InstitutionAgreementService,
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
  }

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
