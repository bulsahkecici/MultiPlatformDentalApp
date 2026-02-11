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
    <h2 mat-dialog-title>Randevu Detayı</h2>
    <mat-dialog-content>
      <p><strong>Hasta:</strong> {{ patientName }}</p>
      <p><strong>Tarih:</strong> {{ formatDate(data.appointmentDate || data.appointment_date) }}</p>
      <p><strong>Saat:</strong> {{ (data.startTime || data.start_time) }} - {{ (data.endTime || data.end_time) }}</p>
      <p><strong>Tür:</strong> {{ (data.appointmentType || data.appointment_type) || '-' }}</p>
      <p><strong>Durum:</strong> {{ statusLabel(data.status) }}</p>
      <p><strong>Not:</strong> {{ data.notes || '-' }}</p>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button (click)="close()">Kapat</button>
      <button mat-stroked-button color="warn" (click)="cancel()">İptal Et</button>
      <button mat-raised-button color="primary" (click)="edit()">
        <mat-icon>edit</mat-icon>
        Düzenle
      </button>
    </mat-dialog-actions>
  `
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
