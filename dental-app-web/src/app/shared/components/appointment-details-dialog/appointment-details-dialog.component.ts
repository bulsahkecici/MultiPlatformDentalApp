import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Appointment } from '../../../core/models/models';

@Component({
  selector: 'app-appointment-details-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">Randevu Detayi</h2>
    <mat-dialog-content class="dialog-content">
      <div class="top-pill">
        <mat-icon>person</mat-icon>
        <span>{{ patientName }}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <small>Tarih</small>
          <strong>{{ formatDate(data.appointmentDate || data.appointment_date) }}</strong>
        </div>
        <div class="detail-item">
          <small>Saat</small>
          <strong>{{ (data.startTime || data.start_time) }} - {{ (data.endTime || data.end_time) }}</strong>
        </div>
        <div class="detail-item">
          <small>Tur</small>
          <strong>{{ (data.appointmentType || data.appointment_type) || '-' }}</strong>
        </div>
        <div class="detail-item">
          <small>Durum</small>
          <strong>{{ statusLabel(data.status) }}</strong>
        </div>
      </div>

      <div class="notes-box">
        <small>Not</small>
        <p>{{ data.notes || '-' }}</p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button (click)="close()">Kapat</button>
      <button mat-stroked-button color="warn" (click)="cancel()">Iptal Et</button>
      <button mat-raised-button color="primary" (click)="edit()">
        <mat-icon>edit</mat-icon>
        Duzenle
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      margin-bottom: 2px;
    }
    .dialog-content {
      min-width: 460px;
      padding-top: 6px;
    }
    .top-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      border-radius: 999px;
      background: #e8f1ff;
      color: #14438a;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .detail-item {
      border: 1px solid #e0e9f7;
      border-radius: 10px;
      padding: 10px 12px;
      background: #f9fbff;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .detail-item small,
    .notes-box small {
      color: #5e6f8f;
      font-size: 0.77rem;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      font-weight: 700;
    }
    .detail-item strong {
      color: #1b2b46;
      font-size: 0.95rem;
    }
    .notes-box {
      margin-top: 12px;
      border: 1px solid #e0e9f7;
      border-radius: 10px;
      padding: 10px 12px;
      background: #fff;
    }
    .notes-box p {
      margin: 6px 0 0;
      color: #32425d;
      white-space: pre-wrap;
    }
    .dialog-actions {
      border-top: 1px solid #e5edf8;
      margin-top: 10px;
      padding: 14px 24px 16px;
      gap: 10px;
    }
    @media (max-width: 640px) {
      .dialog-content {
        min-width: 0;
      }
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AppointmentDetailsDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: Appointment,
    private dialogRef: MatDialogRef<AppointmentDetailsDialogComponent>
  ) {}

  get patientName(): string {
    return `${this.data.patientFirstName || this.data.patient_first_name || ''} ${this.data.patientLastName || this.data.patient_last_name || ''}`.trim() || 'Bilinmiyor';
  }

  edit(): void {
    this.dialogRef.close({ action: 'edit' });
  }

  cancel(): void {
    this.dialogRef.close({ action: 'cancel' });
  }

  close(): void {
    this.dialogRef.close({ action: 'close' });
  }

  formatDate(date?: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('tr-TR');
  }

  statusLabel(status?: string): string {
    if (status === 'scheduled') return 'Planlandı';
    if (status === 'completed') return 'Tamamlandı';
    if (status === 'cancelled') return 'İptal Edildi';
    if (status === 'no_show') return 'Gelmedi';
    return status || '-';
  }
}
