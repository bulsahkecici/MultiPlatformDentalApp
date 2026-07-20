import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { SocketService } from '../../../core/services/socket.service';
import { NotificationService } from '../../../core/services/notification.service';
import { User, Notification } from '../../../core/models/models';

interface MenuItem {
  label: string;
  route: string;
  icon: string;
  roles: string[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatBadgeModule,
    MatTooltipModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav #sidenav mode="side" opened class="sidenav">
        <div class="brand">
          <div class="brand-mark">
            <mat-icon>medical_services</mat-icon>
          </div>
          <div class="brand-text">
            <span class="brand-name">Bulka Dental</span>
            <span class="brand-tag">Klinik Yönetimi</span>
          </div>
        </div>

        <nav class="nav-list">
          <a class="nav-item" routerLink="/dashboard" routerLinkActive="active">
            <mat-icon>dashboard</mat-icon>
            <span>Kontrol Paneli</span>
          </a>

          <a class="nav-item" routerLink="/patients" routerLinkActive="active" *ngIf="canAccessPatients()">
            <mat-icon>people</mat-icon>
            <span>Hastalar</span>
          </a>

          <a class="nav-item" routerLink="/appointments" routerLinkActive="active" *ngIf="canAccessAppointments()">
            <mat-icon>event</mat-icon>
            <span>Randevular</span>
          </a>

          <a class="nav-item" routerLink="/treatments" routerLinkActive="active" *ngIf="canAccessTreatments()">
            <mat-icon>medical_information</mat-icon>
            <span>Tedaviler</span>
          </a>

          <a class="nav-item" routerLink="/payments" routerLinkActive="active" *ngIf="canAccessPayments()">
            <mat-icon>payments</mat-icon>
            <span>Ödemeler</span>
          </a>

          <a class="nav-item" routerLink="/earnings" routerLinkActive="active" *ngIf="isDentist">
            <mat-icon>attach_money</mat-icon>
            <span>Kazançlarım</span>
          </a>

          <a class="nav-item" routerLink="/admin" routerLinkActive="active" *ngIf="isAdmin">
            <mat-icon>admin_panel_settings</mat-icon>
            <span>Kullanıcı Yönetimi</span>
          </a>
        </nav>

        <div class="sidenav-footer">
          <mat-icon>shield</mat-icon>
          <span>Güvenli oturum</span>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <header class="topbar">
          <button mat-icon-button (click)="sidenav.toggle()" class="menu-toggle">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="spacer"></span>

          <button mat-icon-button [matMenuTriggerFor]="notifMenu" matTooltip="Bildirimler" class="icon-btn"
                  (menuOpened)="onNotificationsOpened()">
            <mat-icon [matBadge]="unreadCount > 0 ? unreadCount : null" matBadgeColor="warn" matBadgeSize="small">
              notifications
            </mat-icon>
          </button>
          <mat-menu #notifMenu="matMenu" class="notification-menu">
            <div class="notif-header" (click)="$event.stopPropagation()">
              <span>Bildirimler</span>
              <button mat-button *ngIf="notifications.length > 0" (click)="markAllRead()">
                Tümünü okundu işaretle
              </button>
            </div>
            <div *ngIf="notifications.length === 0" class="notif-empty">
              <mat-icon>notifications_none</mat-icon>
              <span>Bildirim yok</span>
            </div>
            <button mat-menu-item *ngFor="let n of notifications">
              <div class="notif-item">
                <strong>{{ n.title }}</strong>
                <small>{{ n.message }}</small>
              </div>
            </button>
          </mat-menu>

          <div class="user-chip">
            <div class="avatar">{{ userInitial() }}</div>
            <span class="user-email">{{ currentUser?.email }}</span>
          </div>
          <button mat-icon-button (click)="logout()" matTooltip="Çıkış" class="icon-btn">
            <mat-icon>logout</mat-icon>
          </button>
        </header>
        <div class="content">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .sidenav-container {
      height: 100vh;
    }
    .sidenav {
      width: 268px;
      background: linear-gradient(180deg, #1e3a8a 0%, #16296b 100%);
      color: white;
      display: flex;
      flex-direction: column;
      border-right: none;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 20px 20px;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.14);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-mark mat-icon {
      color: #93c5fd;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.25;
      min-width: 0;
    }
    .brand-name {
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    .brand-tag {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.55);
    }
    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px;
      flex: 1 1 auto;
      overflow-y: auto;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 11px 14px;
      border-radius: 10px;
      color: rgba(255, 255, 255, 0.72);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.15s ease, color 0.15s ease;
      position: relative;
    }
    .nav-item mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: inherit;
    }
    .nav-item:hover {
      background: rgba(255, 255, 255, 0.06);
      color: white;
    }
    .nav-item.active {
      background: rgba(59, 130, 246, 0.22);
      color: white;
    }
    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8px;
      bottom: 8px;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: #60a5fa;
    }
    .sidenav-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 24px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .sidenav-footer mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .topbar {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 64px;
      padding: 0 20px;
      background: var(--surface);
      border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .icon-btn {
      color: var(--ink-500);
    }
    .spacer {
      flex: 1 1 auto;
    }
    .user-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px 6px 6px;
      border-radius: 999px;
      background: var(--surface-muted);
      margin-left: 8px;
    }
    .avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: var(--bulka-primary-900, #1e3a8a);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .user-email {
      font-size: 13px;
      font-weight: 500;
      color: var(--ink-700);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .content {
      background: var(--page-bg);
      min-height: calc(100vh - 64px);
    }
    .notif-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      font-weight: 600;
      font-size: 14px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
    }
    .notif-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 24px 16px;
      color: var(--ink-500);
      text-align: center;
      font-size: 13px;
    }
    .notif-item {
      display: flex;
      flex-direction: column;
      line-height: 1.35;
      padding: 2px 0;
    }
    .notif-item small {
      color: var(--ink-500);
    }
  `]
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isAdmin = false;
  isDentist = false;
  isSecretary = false;
  unreadCount = 0;
  notifications: Notification[] = [];
  private notifSub?: Subscription;

  constructor(
    private authService: AuthService,
    private socketService: SocketService,
    private notificationService: NotificationService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.isAdmin = user.roles.includes('admin');
        this.isDentist = user.roles.includes('dentist');
        this.isSecretary = user.roles.includes('secretary');
      }
    });

    // Gerçek zamanlı bildirim bağlantısı (AuthGuard arkasındayız, token mevcut)
    const token = this.authService.getAccessToken();
    if (token) {
      this.socketService.connect(token);
    }
    this.notifSub = this.socketService.notification$.subscribe(n => {
      this.unreadCount++;
      this.snackBar.open(`${n.title}: ${n.message}`, 'Kapat', { duration: 5000 });
    });
    this.refreshUnreadCount();
  }

  ngOnDestroy(): void {
    this.notifSub?.unsubscribe();
    this.socketService.disconnect();
  }

  onNotificationsOpened(): void {
    this.notificationService.getNotifications(20).subscribe({
      next: res => (this.notifications = res.notifications ?? []),
      error: () => (this.notifications = [])
    });
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.unreadCount = 0;
        this.refreshUnreadCount();
      }
    });
  }

  private refreshUnreadCount(): void {
    this.notificationService.getUnreadCount().subscribe({
      next: res => (this.unreadCount = res.count ?? 0),
      error: () => (this.unreadCount = 0)
    });
  }

  userInitial(): string {
    return (this.currentUser?.email || '?').charAt(0).toUpperCase();
  }

  canAccessPatients(): boolean {
    return this.isAdmin || this.isDentist || this.isSecretary;
  }

  canAccessAppointments(): boolean {
    return this.isAdmin || this.isDentist || this.isSecretary;
  }

  canAccessTreatments(): boolean {
    return this.isAdmin || this.isDentist || this.isSecretary;
  }

  canAccessPayments(): boolean {
    return this.isAdmin || this.isSecretary;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
