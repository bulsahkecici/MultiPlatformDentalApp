import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/models';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';

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
    MatIconModule,
    MatRadioModule,
    MatSelectModule,
    MatTabsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    FormsModule,
    MatSnackBarModule
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Kullanıcı Yönetimi</h1>
          <p class="page-subtitle">Personel hesabı oluşturun ve rollerini yönetin</p>
        </div>
      </div>

      <mat-tab-group animationDuration="150ms">
        <mat-tab label="Yeni Kullanıcı Ekle">
          <div class="tab-content">
            <mat-card class="user-type-selection">
              <div class="section-heading">
                <mat-icon>group_add</mat-icon>
                <h3>Kullanıcı Tipi Seçin</h3>
              </div>
              <mat-radio-group [(ngModel)]="selectedUserType" (change)="onUserTypeChange()" class="type-options">
                <label class="type-option" [class.selected]="selectedUserType === 'dentist'">
                  <mat-radio-button value="dentist"></mat-radio-button>
                  <mat-icon>medical_services</mat-icon>
                  <span>Diş Hekimi</span>
                </label>
                <label class="type-option" [class.selected]="selectedUserType === 'secretary'">
                  <mat-radio-button value="secretary"></mat-radio-button>
                  <mat-icon>support_agent</mat-icon>
                  <span>Sekreter</span>
                </label>
                <label class="type-option" [class.selected]="selectedUserType === 'patron'">
                  <mat-radio-button value="patron"></mat-radio-button>
                  <mat-icon>admin_panel_settings</mat-icon>
                  <span>Patron</span>
                </label>
              </mat-radio-group>
            </mat-card>

            <mat-card *ngIf="selectedUserType" class="user-form-card">
              <div class="section-heading">
                <mat-icon>person_add</mat-icon>
                <h3>Yeni {{ getUserTypeLabel() }} Ekle</h3>
              </div>
              <form [formGroup]="userForm" (ngSubmit)="onSubmit()">
                <div class="form-row">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Ad</mat-label>
                    <input matInput formControlName="firstName" required>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Soyad</mat-label>
                    <input matInput formControlName="lastName" required>
                  </mat-form-field>
                </div>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>E-posta</mat-label>
                  <input matInput type="email" formControlName="email" required>
                  <mat-icon matPrefix class="field-icon">mail_outline</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Şifre</mat-label>
                  <input matInput type="password" formControlName="password" required>
                  <mat-icon matPrefix class="field-icon">lock_outline</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Telefon</mat-label>
                  <input matInput formControlName="phone" required>
                  <mat-icon matPrefix class="field-icon">call</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width" *ngIf="selectedUserType === 'dentist' || selectedUserType === 'secretary'">
                  <mat-label>TC Kimlik No</mat-label>
                  <input matInput formControlName="tcNo" [required]="selectedUserType === 'dentist' || selectedUserType === 'secretary'">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width" *ngIf="selectedUserType === 'dentist'">
                  <mat-label>Üniversite</mat-label>
                  <input matInput formControlName="university" [required]="selectedUserType === 'dentist'">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width" *ngIf="selectedUserType === 'dentist'">
                  <mat-label>Diploma No</mat-label>
                  <input matInput formControlName="diplomaNo" [required]="selectedUserType === 'dentist'">
                </mat-form-field>

                <button mat-raised-button color="primary" type="submit" [disabled]="!userForm.valid">
                  <mat-icon>check</mat-icon>
                  Kullanıcı Ekle
                </button>
              </form>
            </mat-card>
          </div>
        </mat-tab>

        <mat-tab label="Mevcut Kullanıcılar">
          <div class="tab-content">
            <div *ngIf="loadingUsers" class="loading"><mat-spinner diameter="36"></mat-spinner></div>

            <div *ngIf="!loadingUsers && users.length === 0" class="empty-state">
              <mat-icon>group_off</mat-icon>
              <div class="empty-title">Henüz personel kaydı yok</div>
            </div>

            <mat-card *ngIf="!loadingUsers && users.length > 0" class="user-list-card">
              <table mat-table [dataSource]="users" class="users-table">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Ad Soyad</th>
                  <td mat-cell *matCellDef="let u">
                    {{ (u.firstName || u.lastName) ? (u.firstName + ' ' + u.lastName) : '-' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="email">
                  <th mat-header-cell *matHeaderCellDef>E-posta</th>
                  <td mat-cell *matCellDef="let u">
                    <mat-form-field appearance="outline" class="inline-edit-field" *ngIf="editingUserId === u.id; else emailText">
                      <input matInput [(ngModel)]="editEmail" [ngModelOptions]="{standalone: true}">
                    </mat-form-field>
                    <ng-template #emailText>{{ u.email }}</ng-template>
                  </td>
                </ng-container>

                <ng-container matColumnDef="roles">
                  <th mat-header-cell *matHeaderCellDef>Rol</th>
                  <td mat-cell *matCellDef="let u">
                    <mat-form-field appearance="outline" class="inline-edit-field" *ngIf="editingUserId === u.id; else roleText">
                      <mat-select [(ngModel)]="editRole" [ngModelOptions]="{standalone: true}">
                        <mat-option value="dentist">Diş Hekimi</mat-option>
                        <mat-option value="secretary">Sekreter</mat-option>
                        <mat-option value="admin">Patron</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <ng-template #roleText>
                      <span class="status-chip status-info">{{ roleLabel(u.roles) }}</span>
                    </ng-template>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let u">
                    <ng-container *ngIf="editingUserId === u.id; else rowActions">
                      <button mat-button (click)="cancelEditUser()">Vazgeç</button>
                      <button mat-raised-button color="primary" [disabled]="savingUserId === u.id" (click)="saveUserEdit(u)">
                        <mat-spinner *ngIf="savingUserId === u.id" diameter="16" class="inline-spinner"></mat-spinner>
                        <span *ngIf="savingUserId !== u.id">Kaydet</span>
                      </button>
                    </ng-container>
                    <ng-template #rowActions>
                      <button mat-icon-button (click)="startEditUser(u)" matTooltip="Düzenle">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="removeUser(u)" matTooltip="Sil">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </ng-template>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="userColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: userColumns"></tr>
              </table>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .page { padding: 24px 32px; }
    .tab-content {
      padding-top: 20px;
    }
    .loading {
      display: flex;
      justify-content: center;
      padding: 40px;
    }
    .user-list-card {
      padding: 0;
      overflow: hidden;
    }
    .users-table {
      width: 100%;
    }
    .inline-edit-field {
      width: 160px;
    }
    ::ng-deep .inline-edit-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
    .inline-spinner {
      display: inline-block;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .user-type-selection {
      margin-bottom: 16px;
      padding: 20px;
    }
    .section-heading {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }
    .section-heading mat-icon {
      color: var(--bulka-primary-600, #2563eb);
    }
    .section-heading h3 {
      margin: 0;
      font-size: 15px;
      color: var(--ink-900);
    }
    .type-options {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .type-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px 10px 6px;
      border-radius: var(--radius-md);
      border: 1.5px solid rgba(15, 23, 42, 0.08);
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .type-option mat-icon {
      color: var(--ink-500);
    }
    .type-option span {
      font-size: 14px;
      font-weight: 500;
      color: var(--ink-700);
    }
    .type-option:hover {
      background: var(--surface-muted);
    }
    .type-option.selected {
      border-color: var(--bulka-primary-500, #3b82f6);
      background: var(--bulka-primary-50, #eff6ff);
    }
    .user-form-card {
      margin-top: 4px;
      padding: 20px;
      max-width: 440px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 6px;
    }
    .field-icon {
      color: var(--ink-500);
      margin-right: 4px;
    }
    button[type="submit"] {
      margin-top: 8px;
    }
  `]
})
export class AdminManagementComponent implements OnInit {
  selectedUserType: string = '';
  userForm: FormGroup;

  users: User[] = [];
  loadingUsers = false;
  userColumns = ['name', 'email', 'roles', 'actions'];
  editingUserId: number | null = null;
  editEmail = '';
  editRole = '';
  savingUserId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {
    this.userForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', Validators.required],
      tcNo: [''],
      university: [''],
      diplomaNo: ['']
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loadingUsers = true;
    this.userService.getUsers().subscribe({
      next: (response) => {
        this.users = response.users || [];
        this.loadingUsers = false;
      },
      error: () => {
        this.loadingUsers = false;
      }
    });
  }

  roleLabel(roles: string[]): string {
    const labels: { [key: string]: string } = {
      dentist: 'Diş Hekimi',
      secretary: 'Sekreter',
      admin: 'Patron'
    };
    return (roles || []).map(r => labels[r] || r).join(', ') || '-';
  }

  startEditUser(u: User): void {
    this.editingUserId = u.id;
    this.editEmail = u.email;
    this.editRole = u.roles?.[0] || '';
  }

  cancelEditUser(): void {
    this.editingUserId = null;
  }

  saveUserEdit(u: User): void {
    const emailChanged = this.editEmail !== u.email;
    const roleChanged = this.editRole !== (u.roles?.[0] || '');

    if (!emailChanged && !roleChanged) {
      this.cancelEditUser();
      return;
    }

    this.savingUserId = u.id;
    const requests: Observable<any>[] = [];
    if (emailChanged) requests.push(this.userService.updateUser(u.id, { email: this.editEmail }));
    if (roleChanged) requests.push(this.userService.updateRoles(u.id, [this.editRole]));

    forkJoin(requests).subscribe({
      next: () => {
        u.email = this.editEmail;
        u.roles = [this.editRole];
        this.snackBar.open('Kullanıcı güncellendi', 'Kapat', { duration: 3000 });
        this.savingUserId = null;
        this.cancelEditUser();
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Kullanıcı güncellenirken hata oluştu';
        this.snackBar.open(errorMsg, 'Kapat', { duration: 5000 });
        this.savingUserId = null;
      }
    });
  }

  removeUser(u: User): void {
    if (!confirm(`${u.email} kullanıcısını silmek istediğinizden emin misiniz?`)) return;
    this.userService.deleteUser(u.id).subscribe({
      next: () => {
        this.users = this.users.filter(x => x.id !== u.id);
        this.snackBar.open('Kullanıcı silindi', 'Kapat', { duration: 3000 });
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Kullanıcı silinirken hata oluştu';
        this.snackBar.open(errorMsg, 'Kapat', { duration: 5000 });
      }
    });
  }

  onUserTypeChange(): void {
    // Reset form when user type changes
    this.userForm.reset();

    const tcNo = this.userForm.get('tcNo');
    const university = this.userForm.get('university');
    const diplomaNo = this.userForm.get('diplomaNo');

    tcNo?.clearValidators();
    university?.clearValidators();
    diplomaNo?.clearValidators();

    if (this.selectedUserType === 'dentist') {
      tcNo?.setValidators(Validators.required);
      university?.setValidators(Validators.required);
      diplomaNo?.setValidators(Validators.required);
    } else if (this.selectedUserType === 'secretary') {
      tcNo?.setValidators(Validators.required);
    }

    tcNo?.updateValueAndValidity();
    university?.updateValueAndValidity();
    diplomaNo?.updateValueAndValidity();
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
      // "patron" arayüzde kullanılan etiket; backend rolü 'admin' bekliyor.
      const role = this.selectedUserType === 'patron' ? 'admin' : this.selectedUserType;
      const formValue = this.userForm.value;

      const userData: {
        email: string;
        password: string;
        roles: string[];
        firstName: string;
        lastName: string;
        phone: string;
        tcNo?: string;
        university?: string;
        diplomaNo?: string;
      } = {
        email: formValue.email,
        password: formValue.password,
        roles: [role],
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        phone: formValue.phone
      };

      if (role === 'dentist') {
        userData.tcNo = formValue.tcNo;
        userData.university = formValue.university;
        userData.diplomaNo = formValue.diplomaNo;
      } else if (role === 'secretary') {
        userData.tcNo = formValue.tcNo;
      }

      this.userService.createUser(userData).subscribe({
        next: () => {
          this.snackBar.open('Kullanıcı başarıyla oluşturuldu', 'Kapat', { duration: 3000 });
          this.userForm.reset();
          this.selectedUserType = '';
          this.loadUsers();
        },
        error: (error) => {
          const errorMsg = error.error?.message || 'Kullanıcı oluşturulurken hata oluştu';
          this.snackBar.open(errorMsg, 'Kapat', { duration: 5000 });
        }
      });
    }
  }
}
