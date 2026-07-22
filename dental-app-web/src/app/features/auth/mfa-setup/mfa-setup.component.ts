import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
}

interface MfaEnableResponse {
  enabled: boolean;
  recoveryCodes: string[];
}

@Component({
  selector: 'app-mfa-setup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  template: `
    <main class="setup-page">
      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>security</mat-icon>
          <mat-card-title>İki aşamalı doğrulamayı kurun</mat-card-title>
          <mat-card-subtitle>Bu işlem tamamlanmadan klinik verilerine erişilemez.</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div *ngIf="loading" class="loading"><mat-spinner diameter="36"></mat-spinner></div>
          <div *ngIf="error" class="error">{{ error }}</div>

          <ng-container *ngIf="setup && recoveryCodes.length === 0">
            <ol>
              <li>Microsoft Authenticator, Google Authenticator veya uyumlu bir uygulama açın.</li>
              <li>Yeni hesap ekleyip aşağıdaki anahtarı elle girin.</li>
              <li>Uygulamadaki 6 haneli kodla kurulumu doğrulayın.</li>
            </ol>
            <div class="secret">
              <span>Kurulum anahtarı</span>
              <code>{{ setup.secret }}</code>
              <button mat-stroked-button type="button" (click)="copySecret()">Kopyala</button>
            </div>
            <form [formGroup]="form" (ngSubmit)="enable()">
              <mat-form-field appearance="outline">
                <mat-label>6 haneli doğrulama kodu</mat-label>
                <input matInput formControlName="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6">
              </mat-form-field>
              <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
                {{ saving ? 'Doğrulanıyor…' : 'MFA’yı etkinleştir' }}
              </button>
            </form>
          </ng-container>

          <section *ngIf="recoveryCodes.length > 0">
            <h2>Kurtarma kodlarını güvenli yere kaydedin</h2>
            <p>Bu kodlar yalnızca şimdi gösterilir. Her kod tek kullanımlıktır.</p>
            <div class="codes"><code *ngFor="let code of recoveryCodes">{{ code }}</code></div>
            <button mat-stroked-button type="button" (click)="copyRecoveryCodes()">Tümünü kopyala</button>
            <label class="confirmation">
              <input type="checkbox" [checked]="codesSaved" (change)="codesSaved = !codesSaved">
              Kodları çevrimdışı ve güvenli bir yere kaydettim.
            </label>
            <button mat-raised-button color="primary" [disabled]="!codesSaved" (click)="finish()">
              Tamamla ve tekrar giriş yap
            </button>
          </section>
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: [`
    .setup-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f0fdfa; }
    mat-card { width: min(680px, 100%); padding: 20px; }
    mat-card-content { margin-top: 24px; }
    .loading { display: flex; justify-content: center; padding: 32px; }
    .error { color: #b91c1c; background: #fef2f2; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
    li { margin-bottom: 8px; }
    .secret { display: grid; gap: 8px; padding: 16px; background: #f8fafc; border-radius: 8px; margin: 20px 0; }
    .secret code { overflow-wrap: anywhere; font-size: 16px; }
    form { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
    mat-form-field { flex: 1 1 260px; }
    .codes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding: 16px; background: #f8fafc; margin: 16px 0; }
    .confirmation { display: flex; gap: 10px; margin: 20px 0; }
    @media (max-width: 520px) { .codes { grid-template-columns: 1fr; } }
  `]
})
export class MfaSetupComponent implements OnInit {
  setup?: MfaSetupResponse;
  recoveryCodes: string[] = [];
  loading = true;
  saving = false;
  codesSaved = false;
  error = '';
  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.api.post<MfaSetupResponse>('/api/auth/mfa/setup', {}).subscribe({
      next: setup => { this.setup = setup; this.loading = false; },
      error: err => { this.error = err.error?.error?.message || 'MFA kurulumu başlatılamadı.'; this.loading = false; }
    });
  }

  enable(): void {
    if (this.form.invalid) return;
    this.saving = true;
    this.error = '';
    this.api.post<MfaEnableResponse>('/api/auth/mfa/enable', this.form.getRawValue()).subscribe({
      next: result => { this.recoveryCodes = result.recoveryCodes; this.saving = false; },
      error: err => { this.error = err.error?.error?.message || 'Kod doğrulanamadı.'; this.saving = false; }
    });
  }

  copySecret(): void {
    if (this.setup) navigator.clipboard.writeText(this.setup.secret);
  }

  copyRecoveryCodes(): void {
    navigator.clipboard.writeText(this.recoveryCodes.join('\n'));
  }

  finish(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
