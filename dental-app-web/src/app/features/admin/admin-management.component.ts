import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserService } from '../../core/services/user.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatRadioModule,
    MatSelectModule,
    MatTabsModule,
    FormsModule,
    MatSnackBarModule
  ],
  template: `
    <div class="admin-container">
      <h1>Kullanıcı Yönetimi</h1>

      <mat-card class="user-type-selection">
        <mat-card-content>
          <h3>Kullanıcı Tipi Seçin</h3>
          <mat-radio-group [(ngModel)]="selectedUserType" (change)="onUserTypeChange()">
            <mat-radio-button value="dentist">Diş Hekimi</mat-radio-button>
            <mat-radio-button value="secretary">Sekreter</mat-radio-button>
            <mat-radio-button value="patron">Patron</mat-radio-button>
          </mat-radio-group>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="selectedUserType" class="user-form-card">
        <mat-card-header>
          <mat-card-title>Yeni {{ getUserTypeLabel() }} Ekle</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="userForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>E-posta</mat-label>
              <input matInput type="email" formControlName="email" required>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Şifre</mat-label>
              <input matInput type="password" formControlName="password" required>
            </mat-form-field>

            <button mat-raised-button color="primary" type="submit" [disabled]="!userForm.valid">
              Kullanıcı Ekle
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .admin-container {
      padding: 20px;
    }
    .user-type-selection {
      margin-bottom: 20px;
    }
    .user-type-selection h3 {
      margin-bottom: 16px;
    }
    .user-form-card {
      margin-top: 20px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
  `]
})
export class AdminManagementComponent {
  selectedUserType: string = '';
  userForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {
    this.userForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onUserTypeChange(): void {
    // Reset form when user type changes
    this.userForm.reset();
  }

  getUserTypeLabel(): string {
    const labels: { [key: string]: string } = {
      'dentist': 'Diş Hekimi',
      'secretary': 'Sekreter',
      'patron': 'Patron'
    };
    return labels[this.selectedUserType] || '';
  }

  onSubmit(): void {
    if (this.userForm.valid && this.selectedUserType) {
      const userData = {
        email: this.userForm.value.email,
        password: this.userForm.value.password,
        roles: [this.selectedUserType],
        ...(this.selectedUserType === 'dentist' && {
          firstName: '',
          lastName: '',
          phone: '',
          tcNo: '',
          university: '',
          diplomaNo: ''
        }),
        ...(this.selectedUserType === 'secretary' && {
          firstName: '',
          lastName: '',
          phone: '',
          tcNo: ''
        }),
        ...(this.selectedUserType === 'admin' && {
          firstName: '',
          lastName: '',
          phone: ''
        })
      };

      this.userService.createUser(userData).subscribe({
        next: () => {
          this.snackBar.open('Kullanıcı başarıyla oluşturuldu', 'Kapat', { duration: 3000 });
          this.userForm.reset();
          this.selectedUserType = '';
        },
        error: (error) => {
          const errorMsg = error.error?.message || 'Kullanıcı oluşturulurken hata oluştu';
          this.snackBar.open(errorMsg, 'Kapat', { duration: 5000 });
        }
      });
    }
  }
}
