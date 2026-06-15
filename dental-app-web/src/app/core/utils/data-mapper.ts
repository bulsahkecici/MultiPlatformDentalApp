import { Patient, Appointment, Treatment } from '../models/models';

/**
 * Maps backend snake_case data to frontend camelCase format
 */
export class DataMapper {
  static mapPatient(patient: any): Patient {
    return {
      id: patient.id,
      firstName: patient.first_name || patient.firstName,
      lastName: patient.last_name || patient.lastName,
      dateOfBirth: patient.date_of_birth || patient.dateOfBirth,
      gender: patient.gender,
      email: patient.email,
      phone: patient.phone,
      address: patient.address,
      city: patient.city,
      postalCode: patient.postal_code || patient.postalCode,
      country: patient.country,
      bloodType: patient.blood_type || patient.bloodType,
      allergies: patient.allergies,
      medicalConditions: patient.medical_conditions || patient.medicalConditions,
      currentMedications: patient.current_medications || patient.currentMedications,
      emergencyContactName: patient.emergency_contact_name || patient.emergencyContactName,
      emergencyContactPhone: patient.emergency_contact_phone || patient.emergencyContactPhone,
      insuranceProvider: patient.insurance_provider || patient.insuranceProvider,
      insurancePolicyNumber: patient.insurance_policy_number || patient.insurancePolicyNumber,
      notes: patient.notes,
      createdAt: patient.created_at || patient.createdAt,
      institutionAgreementId: patient.institution_agreement_id || patient.institutionAgreementId
    };
  }

  static mapAppointment(appointment: any): Appointment {
    return {
      id: appointment.id,
      patientId: appointment.patient_id || appointment.patientId,
      dentistId: appointment.dentist_id || appointment.dentistId,
      appointmentDate: appointment.appointment_date || appointment.appointmentDate,
      startTime: appointment.start_time || appointment.startTime,
      endTime: appointment.end_time || appointment.endTime,
      appointmentType: appointment.appointment_type || appointment.appointmentType,
      status: appointment.status,
      notes: appointment.notes,
      cancellationReason: appointment.cancellation_reason || appointment.cancellationReason,
      patientFirstName: appointment.patient_first_name || appointment.patientFirstName,
      patientLastName: appointment.patient_last_name || appointment.patientLastName,
      dentistEmail: appointment.dentist_email || appointment.dentistEmail
    };
  }

  static mapTreatment(treatment: any): Treatment {
    return {
      id: treatment.id,
      patientId: treatment.patient_id || treatment.patientId,
      appointmentId: treatment.appointment_id || treatment.appointmentId,
      dentistId: treatment.dentist_id || treatment.dentistId,
      treatmentDate: treatment.treatment_date || treatment.treatmentDate,
      treatmentType: treatment.treatment_type || treatment.treatmentType,
      toothNumber: treatment.tooth_number || treatment.toothNumber,
      description: treatment.description,
      diagnosis: treatment.diagnosis,
      procedureNotes: treatment.procedure_notes || treatment.procedureNotes,
      cost: treatment.cost,
      currency: treatment.currency || 'TRY',
      status: treatment.status,
      patientFirstName: treatment.patient_first_name || treatment.patientFirstName,
      patientLastName: treatment.patient_last_name || treatment.patientLastName,
      dentistEmail: treatment.dentist_email || treatment.dentistEmail
    };
  }

  static mapPatientToBackend(patient: Partial<Patient>): any {
    return {
      first_name: patient.firstName || patient.first_name,
      last_name: patient.lastName || patient.last_name,
      date_of_birth: patient.dateOfBirth || patient.date_of_birth,
      gender: patient.gender,
      email: patient.email,
      phone: patient.phone,
      address: patient.address,
      city: patient.city,
      postal_code: patient.postalCode || patient.postal_code,
      country: patient.country,
      blood_type: patient.bloodType || patient.blood_type,
      allergies: patient.allergies,
      medical_conditions: patient.medicalConditions || patient.medical_conditions,
      current_medications: patient.currentMedications || patient.current_medications,
      emergency_contact_name: patient.emergencyContactName || patient.emergency_contact_name,
      emergency_contact_phone: patient.emergencyContactPhone || patient.emergency_contact_phone,
      insurance_provider: patient.insuranceProvider || patient.insurance_provider,
      insurance_policy_number: patient.insurancePolicyNumber || patient.insurance_policy_number,
      notes: patient.notes,
      institutionAgreementId: patient.institutionAgreementId || patient.institution_agreement_id
    };
  }

  static mapAppointmentToBackend(appointment: Partial<Appointment>): any {
    return {
      patient_id: appointment.patientId || appointment.patient_id,
      dentist_id: appointment.dentistId || appointment.dentist_id,
      appointment_date: appointment.appointmentDate || appointment.appointment_date,
      start_time: appointment.startTime || appointment.start_time,
      end_time: appointment.endTime || appointment.end_time,
      appointment_type: appointment.appointmentType || appointment.appointment_type,
      status: appointment.status,
      notes: appointment.notes
    };
  }

  static mapTreatmentToBackend(treatment: Partial<Treatment>): any {
    return {
      patient_id: treatment.patientId || treatment.patient_id,
      appointment_id: treatment.appointmentId || treatment.appointment_id,
      dentist_id: treatment.dentistId || treatment.dentist_id,
      treatment_date: treatment.treatmentDate || treatment.treatment_date,
      treatment_type: treatment.treatmentType || treatment.treatment_type,
      tooth_number: treatment.toothNumber || treatment.tooth_number,
      description: treatment.description,
      diagnosis: treatment.diagnosis,
      procedure_notes: treatment.procedureNotes || treatment.procedure_notes,
      cost: treatment.cost,
      currency: treatment.currency || 'TRY',
      status: treatment.status || 'planned'
    };
  }
}
