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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';

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
    FormsModule,
    MatSnackBarModule,
    MatTableModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  template: `
    <div class="admin-container">
      <h1>Kullanici Yonetimi</h1>

      <div class="layout-grid">
        <mat-card class="user-form-card">
          <mat-card-content>
            <h3>Kullanici Tipi Secin</h3>
            <mat-radio-group [(ngModel)]="selectedUserType" (change)="onUserTypeChange()" class="type-group">
              <mat-radio-button value="dentist">Dis Hekimi</mat-radio-button>
              <mat-radio-button value="secretary">Sekreter</mat-radio-button>
              <mat-radio-button value="patron">Patron</mat-radio-button>
            </mat-radio-group>

            <form [formGroup]="userForm" (ngSubmit)="onSubmit()" *ngIf="selectedUserType">
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Ad</mat-label>
                  <input matInput formControlName="firstName">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Soyad</mat-label>
                  <input matInput formControlName="lastName">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Telefon</mat-label>
                  <input matInput formControlName="phone">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>TC No</mat-label>
                  <input matInput formControlName="tcNo">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>E-posta</mat-label>
                  <input matInput type="email" formControlName="email">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Sifre</mat-label>
                  <input matInput type="password" formControlName="password">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width" *ngIf="isDentistOrSecretary()">
                  <mat-label>Adres</mat-label>
                  <input matInput formControlName="address">
                </mat-form-field>

                <mat-form-field appearance="outline" *ngIf="isDentistOrSecretary()">
                  <mat-label>IBAN</mat-label>
                  <input matInput formControlName="iban">
                </mat-form-field>
                <mat-form-field appearance="outline" *ngIf="isDentistOrSecretary()">
                  <mat-label>Maas</mat-label>
                  <input matInput type="number" formControlName="salary">
                </mat-form-field>

                <mat-form-field appearance="outline" *ngIf="selectedUserType === 'dentist'">
                  <mat-label>Komisyon Orani (%)</mat-label>
                  <input matInput type="number" formControlName="commissionRate">
                </mat-form-field>
                <mat-form-field appearance="outline" *ngIf="selectedUserType === 'dentist'">
                  <mat-label>Universite</mat-label>
                  <input matInput formControlName="university">
                </mat-form-field>

                <mat-form-field appearance="outline" *ngIf="selectedUserType === 'dentist'">
                  <mat-label>Diploma No</mat-label>
                  <input matInput formControlName="diplomaNo">
                </mat-form-field>
                <mat-form-field appearance="outline" *ngIf="selectedUserType === 'dentist'">
                  <mat-label>Diploma Tarihi</mat-label>
                  <input matInput type="date" formControlName="diplomaDate">
                </mat-form-field>
              </div>

              <div class="specializations" *ngIf="selectedUserType === 'dentist'">
                <h4>Uzmanliklar</h4>
                <div class="spec-grid">
                  <mat-checkbox *ngFor="let spec of specializationOptions" [checked]="selectedSpecializations.has(spec)" (change)="toggleSpecialization(spec, $event.checked)">
                    {{ spec }}
                  </mat-checkbox>
                </div>
              </div>

              <div class="row-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="!userForm.valid">Kullanici Ekle</button>
                <button mat-stroked-button type="button" (click)="onUserTypeChange()">Temizle</button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>

        <mat-card class="users-list-card">
          <mat-card-header>
            <mat-card-title>Mevcut Kullanicilar</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="row-actions">
              <mat-form-field appearance="outline" class="search-field">
                <mat-label>Ara</mat-label>
                <input matInput [(ngModel)]="search" (ngModelChange)="loadUsers()">
              </mat-form-field>
              <button mat-stroked-button (click)="loadUsers()">Yenile</button>
            </div>

            <table mat-table [dataSource]="users" class="users-table">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Ad Soyad</th>
                <td mat-cell *matCellDef="let u">{{ displayName(u) }}</td>
              </ng-container>
              <ng-container matColumnDef="email">
                <th mat-header-cell *matHeaderCellDef>E-posta</th>
                <td mat-cell *matCellDef="let u">{{ u.email }}</td>
              </ng-container>
              <ng-container matColumnDef="roles">
                <th mat-header-cell *matHeaderCellDef>Rol</th>
                <td mat-cell *matCellDef="let u">{{ (u.roles || []).join(', ') }}</td>
              </ng-container>
              <ng-container matColumnDef="phone">
                <th mat-header-cell *matHeaderCellDef>Telefon</th>
                <td mat-cell *matCellDef="let u">{{ u.phone || '-' }}</td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Islemler</th>
                <td mat-cell *matCellDef="let u" class="actions-cell">
                  <ng-container *ngIf="editingRoleUserId !== u.id; else roleEditRow">
                    <button mat-icon-button color="primary" (click)="startRoleEdit(u)" matTooltip="Rolu duzenle">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteUser(u)" matTooltip="Kullaniciyi sil">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </ng-container>
                  <ng-template #roleEditRow>
                    <div class="role-edit-inline">
                      <mat-form-field appearance="outline">
                        <mat-label>Rol</mat-label>
                        <mat-select [(ngModel)]="editingRoleValue">
                          <mat-option value="dentist">Dis Hekimi</mat-option>
                          <mat-option value="secretary">Sekreter</mat-option>
                          <mat-option value="admin">Patron</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <button mat-icon-button color="primary" (click)="saveRoleEdit(u)">
                        <mat-icon>check</mat-icon>
                      </button>
                      <button mat-icon-button (click)="cancelRoleEdit()">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  </ng-template>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="userColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: userColumns"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .admin-container { padding: 20px; }
    .layout-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; }
    .type-group { display: flex; gap: 16px; margin-bottom: 16px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 10px; }
    .full-width { grid-column: span 2; }
    .specializations { margin-top: 12px; }
    .spec-grid { display: grid; grid-template-columns: repeat(3, minmax(130px, 1fr)); gap: 8px; }
    .row-actions { display: flex; gap: 10px; align-items: center; margin-top: 12px; }
    .search-field { flex: 1; }
    .users-table { width: 100%; margin-top: 12px; }
    .actions-cell { min-width: 240px; }
    .role-edit-inline {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .role-edit-inline .mat-mdc-form-field {
      width: 150px;
    }
  `]
})
export class AdminManagementComponent implements OnInit {
  selectedUserType = '';
  userForm: FormGroup;
  users: any[] = [];
  userColumns: string[] = ['name', 'email', 'roles', 'phone', 'actions'];
  search = '';
  selectedSpecializations = new Set<string>();
  editingRoleUserId: number | null = null;
  editingRoleValue: 'dentist' | 'secretary' | 'admin' = 'dentist';

  specializationOptions = [
    'Dis Tabibi',
    'Agiz-Dis-Cene Cerrahisi',
    'Radyoloji',
    'Endodonti',
    'Ortodonti',
    'Pedodonti',
    'Periodontoloji',
    'Protetik',
    'Restoratif'
  ];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {
    this.userForm = this.fb.group({
      firstName: [''],
      lastName: [''],
      phone: [''],
      tcNo: [''],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      address: [''],
      iban: [''],
      salary: [null],
      commissionRate: [null],
      university: [''],
      diplomaNo: [''],
      diplomaDate: ['']
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  onUserTypeChange(): void {
    this.userForm.reset();
    this.selectedSpecializations.clear();

    Object.keys(this.userForm.controls).forEach(k => {
      this.userForm.get(k)?.clearValidators();
      this.userForm.get(k)?.updateValueAndValidity({ emitEvent: false });
    });

    this.userForm.get('email')?.setValidators([Validators.required, Validators.email]);
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);

    const requireCommon = ['firstName', 'lastName', 'phone'];
    if (this.selectedUserType === 'dentist') {
      [...requireCommon, 'tcNo', 'university', 'diplomaNo'].forEach(f => this.userForm.get(f)?.setValidators([Validators.required]));
    }
    if (this.selectedUserType === 'secretary') {
      [...requireCommon, 'tcNo'].forEach(f => this.userForm.get(f)?.setValidators([Validators.required]));
    }
    if (this.selectedUserType === 'patron') {
      requireCommon.forEach(f => this.userForm.get(f)?.setValidators([Validators.required]));
    }

    Object.keys(this.userForm.controls).forEach(k => this.userForm.get(k)?.updateValueAndValidity({ emitEvent: false }));
  }

  isDentistOrSecretary(): boolean {
    return this.selectedUserType === 'dentist' || this.selectedUserType === 'secretary';
  }

  toggleSpecialization(spec: string, checked: boolean): void {
    if (checked) this.selectedSpecializations.add(spec);
    else this.selectedSpecializations.delete(spec);
  }

  loadUsers(): void {
    this.userService.getUsers(1000, undefined, 1, this.search || undefined).subscribe({
      next: (res) => {
        this.users = res.users || [];
      },
      error: () => {
        this.users = [];
      }
    });
  }

  displayName(user: any): string {
    const first = user.firstName || user.first_name || '';
    const last = user.lastName || user.last_name || '';
    const full = `${first} ${last}`.trim();
    return full || '-';
  }

  startRoleEdit(user: any): void {
    this.editingRoleUserId = user.id;
    const role = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles[0] : 'dentist';
    this.editingRoleValue = (role === 'admin' || role === 'secretary' || role === 'dentist') ? role : 'dentist';
  }

  cancelRoleEdit(): void {
    this.editingRoleUserId = null;
  }

  saveRoleEdit(user: any): void {
    if (this.editingRoleUserId !== user.id) return;
    this.userService.updateUserRoles(user.id, [this.editingRoleValue]).subscribe({
      next: () => {
        this.snackBar.open('Kullanici rolu guncellendi', 'Kapat', { duration: 2500 });
        this.cancelRoleEdit();
        this.loadUsers();
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Rol guncellenirken hata olustu';
        this.snackBar.open(errorMsg, 'Kapat', { duration: 4000 });
      }
    });
  }

  deleteUser(user: any): void {
    if (!confirm(`${user.email} kullanicisini silmek istiyor musunuz?`)) return;

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.snackBar.open('Kullanici silindi', 'Kapat', { duration: 2500 });
        this.cancelRoleEdit();
        this.loadUsers();
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Kullanici silinirken hata olustu';
        this.snackBar.open(errorMsg, 'Kapat', { duration: 4000 });
      }
    });
  }

  onSubmit(): void {
    if (!this.userForm.valid || !this.selectedUserType) return;

    const mappedRole = this.selectedUserType === 'patron' ? 'admin' : this.selectedUserType;
    const value = this.userForm.value;

    const userData: any = {
      email: value.email,
      password: value.password,
      roles: [mappedRole],
      firstName: value.firstName,
      lastName: value.lastName,
      phone: value.phone,
      tcNo: value.tcNo,
      address: value.address || null,
      iban: value.iban || null,
      salary: value.salary || null,
      commissionRate: this.selectedUserType === 'dentist' ? (value.commissionRate || null) : null,
      university: this.selectedUserType === 'dentist' ? (value.university || null) : null,
      diplomaDate: this.selectedUserType === 'dentist' ? (value.diplomaDate || null) : null,
      diplomaNo: this.selectedUserType === 'dentist' ? (value.diplomaNo || null) : null,
      specializations: this.selectedUserType === 'dentist' ? Array.from(this.selectedSpecializations.values()) : null
    };

    this.userService.createUser(userData).subscribe({
      next: () => {
        this.snackBar.open('Kullanici basariyla olusturuldu', 'Kapat', { duration: 3000 });
        this.onUserTypeChange();
        this.selectedUserType = '';
        this.loadUsers();
      },
      error: (error) => {
        const errorMsg = error.error?.message || 'Kullanici olusturulurken hata olustu';
        this.snackBar.open(errorMsg, 'Kapat', { duration: 5000 });
      }
    });
  }
}
