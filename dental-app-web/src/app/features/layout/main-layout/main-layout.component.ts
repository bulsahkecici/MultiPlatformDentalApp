import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NotificationSocketService } from '../../../core/services/notification-socket.service';
import { User } from '../../../core/models/models';

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
    MatTooltipModule
  ],
  template: `
    <mat-sidenav-container class="app-shell">
      <mat-sidenav #sidenav mode="side" opened class="app-sidenav">
        <div class="sidenav-header">
          <div class="brand-mark">BD</div>
          <div>
            <h2>BULKA DENTAL</h2>
            <p>Klinik Operasyon Paneli</p>
          </div>
        </div>
        <mat-nav-list class="nav-list">
          <a mat-list-item
             *ngFor="let item of menuItems"
             [routerLink]="item.route"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: true }"
             [class.hidden]="!canAccess(item)">
            <mat-icon>{{ item.icon }}</mat-icon>
            <span>{{ item.label }}</span>
          </a>
        </mat-nav-list>

        <div class="sidenav-footer">
          <div class="user-badge">
            <mat-icon>verified_user</mat-icon>
            <span>{{ roleLabel() }}</span>
          </div>
        </div>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar color="primary" class="topbar">
          <button mat-icon-button (click)="sidenav.toggle()" matTooltip="Menü">
            <mat-icon>menu</mat-icon>
          </button>
          <div class="topbar-title">
            <strong>Klinik Paneli</strong>
            <small>Hasta, randevu ve finans takibi</small>
          </div>
          <span class="spacer"></span>
          <button mat-icon-button matTooltip="Bildirimler"
                  [matBadge]="unreadCount"
                  matBadgeColor="warn"
                  [matBadgeHidden]="unreadCount === 0">
            <mat-icon>notifications</mat-icon>
          </button>
          <span class="user-email">{{ currentUser?.email }}</span>
          <button mat-icon-button (click)="logout()" matTooltip="Çıkış">
            <mat-icon>logout</mat-icon>
          </button>
        </mat-toolbar>
        <div class="content-wrap">
          <router-outlet></router-outlet>
        </div>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .app-shell {
      height: 100vh;
    }

    .app-sidenav {
      width: 286px;
      border-right: 1px solid #254f89;
      background: linear-gradient(180deg, #10294f 0%, #12335f 60%, #153e75 100%);
      color: #d9e7ff;
    }

    .sidenav-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 20px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    .brand-mark {
      width: 42px;
      height: 42px;
      border-radius: 11px;
      background: linear-gradient(135deg, #6cc1ff, #2e88ff);
      color: #fff;
      font-weight: 700;
      display: grid;
      place-items: center;
      letter-spacing: 0.6px;
    }

    .sidenav-header h2 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }

    .sidenav-header p {
      margin: 3px 0 0;
      font-size: 0.78rem;
      color: #b5cff7;
    }

    .nav-list {
      padding: 12px 10px 0;
    }

    .nav-list a {
      margin-bottom: 5px;
      border-radius: 10px;
      color: #dbe7fb;
      transition: transform 0.15s ease, background-color 0.15s ease;
    }

    .nav-list a:hover {
      background: rgba(255, 255, 255, 0.09);
      transform: translateX(2px);
    }

    .nav-list a.active {
      background: linear-gradient(135deg, rgba(72, 149, 255, 0.95), rgba(33, 111, 227, 0.95));
      color: #fff;
      box-shadow: 0 8px 22px rgba(20, 30, 70, 0.35);
    }

    .nav-list a.hidden {
      display: none;
    }

    .nav-list mat-icon {
      margin-right: 10px;
      color: inherit;
    }

    .sidenav-footer {
      margin: auto 14px 16px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }

    .user-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      color: #eff5ff;
      font-size: 0.83rem;
    }

    .topbar {
      gap: 12px;
      padding: 0 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.18);
    }

    .topbar-title {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
    }

    .topbar-title small {
      opacity: 0.85;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.2px;
    }

    .user-email {
      display: inline-block;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.9rem;
    }

    .spacer {
      flex: 1 1 auto;
    }

    .content-wrap {
      height: calc(100vh - 64px);
      overflow: auto;
      background: transparent;
    }

    @media (max-width: 960px) {
      .app-sidenav {
        width: 265px;
      }
      .user-email {
        max-width: 135px;
      }
    }
  `]
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  isAdmin = false;
  isDentist = false;
  isSecretary = false;
  unreadCount = 0;
  private subscriptions = new Subscription();
  menuItems: MenuItem[] = [
    { label: 'Kontrol Paneli', route: '/dashboard', icon: 'dashboard', roles: ['admin', 'dentist', 'secretary'] },
    { label: 'Hastalar', route: '/patients', icon: 'groups', roles: ['admin', 'dentist', 'secretary'] },
    { label: 'Randevular', route: '/appointments', icon: 'event', roles: ['admin', 'dentist', 'secretary'] },
    { label: 'Tedaviler', route: '/treatments', icon: 'medical_services', roles: ['admin', 'dentist', 'secretary'] },
    { label: 'Ödemeler', route: '/payments', icon: 'payments', roles: ['admin', 'secretary'] },
    { label: 'Kazançlarım', route: '/earnings', icon: 'monitoring', roles: ['dentist'] },
    { label: 'Kullanıcı Yönetimi', route: '/admin', icon: 'admin_panel_settings', roles: ['admin'] }
  ];

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private notificationSocket: NotificationSocketService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.isAdmin = user.roles.includes('admin');
          this.isDentist = user.roles.includes('dentist');
          this.isSecretary = user.roles.includes('secretary');
        }
      })
    );

    this.subscriptions.add(
      this.notificationService.unreadCount$.subscribe(count => {
        this.unreadCount = count;
      })
    );

    this.authService.validateSession().subscribe(user => {
      if (user) {
        this.connectNotifications();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.notificationSocket.disconnect();
  }

  private connectNotifications(): void {
    const token = this.authService.getAccessToken();
    if (!token) return;

    this.notificationSocket.connect(token);
    this.notificationService.getUnreadCount().subscribe();

    this.subscriptions.add(
      this.notificationSocket.notification$.subscribe(() => {
        this.notificationService.incrementUnreadCount();
      })
    );
  }

  canAccess(item: MenuItem): boolean {
    if (!this.currentUser) return false;
    return item.roles.some(r => this.currentUser?.roles?.includes(r));
  }

  roleLabel(): string {
    if (this.isAdmin) return 'Admin';
    if (this.isSecretary) return 'Sekreter';
    if (this.isDentist) return 'Diş Hekimi';
    return 'Kullanıcı';
  }

  logout(): void {
    this.notificationSocket.disconnect();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
