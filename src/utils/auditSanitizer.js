/**
 * Audit logları asla hasta sağlık verisinin (tanı, prosedür notu, randevu
 * notu, alerji, iletişim bilgisi vb.) ikinci bir kopyasını tutmamalı — bu
 * veriler zaten asıl klinik tablolarda (treatments, appointments, patients)
 * saklanıyor; audit_logs sadece "kim/ne zaman/hangi alanları değiştirdi"
 * bilgisini taşımalı.
 *
 * Bu modül, her kaynak türü (resourceType) için hangi alanların değer olarak
 * (allowlist) loglanabileceğini, geri kalan her şeyin sadece alan ADI olarak
 * (changedFieldNames) görüneceğini tanımlar.
 */

// Bu alanlar hiçbir zaman değer olarak loglanmaz — sadece "değişti" bilgisi kalır.
const NEVER_LOG_VALUE_FIELDS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'authorization',
  'diagnosis',
  'procedureNotes',
  'procedure_notes',
  'description',
  'notes',
  'cancellationReason',
  'cancellation_reason',
  'medicalConditions',
  'medical_conditions',
  'allergies',
  'currentMedications',
  'current_medications',
  'emergencyContactPhone',
  'emergency_contact_phone',
  'emergencyContactName',
  'emergency_contact_name',
  'insurancePolicyNumber',
  'insurance_policy_number',
  'address',
  'phone',
  'email',
  'tcNo',
  'tc_no',
  'iban',
]);

// Bu kaynak türleri için, allowlist dışındaki HERHANGİ bir alan da varsayılan
// olarak değer değil, yalnızca ad olarak loglanır (hassas veri yoğun kaynaklar).
const VALUE_ALLOWLIST_BY_RESOURCE = {
  treatment: new Set([
    'status',
    'cost',
    'currency',
    'treatmentType',
    'treatment_type',
    'toothNumber',
    'tooth_number',
    'dentistId',
    'dentist_id',
    'patientId',
    'patient_id',
    'voidReason', // reason kelimesi geneldeyse de void nedeni denetim için gereklidir
  ]),
  appointment: new Set([
    'status',
    'appointmentDate',
    'appointment_date',
    'startTime',
    'start_time',
    'endTime',
    'end_time',
    'dentistId',
    'dentist_id',
    'patientId',
    'patient_id',
    'appointmentType',
    'appointment_type',
  ]),
  patient: new Set(['firstName', 'first_name', 'lastName', 'last_name']),
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} resourceType - logDataEvent'e verilen resourceType (ör. 'treatment')
 * @param {object} changes - loglanmak istenen ham değişiklik nesnesi
 * @returns {object} audit_logs.metadata.changes olarak saklanmaya güvenli hale getirilmiş nesne
 */
function sanitizeAuditChanges(resourceType, changes) {
  if (!isPlainObject(changes)) {
    return {};
  }

  const allowlist = VALUE_ALLOWLIST_BY_RESOURCE[resourceType] || null;
  const changedFieldNames = [];
  const safeValues = {};

  for (const key of Object.keys(changes)) {
    changedFieldNames.push(key);

    if (NEVER_LOG_VALUE_FIELDS.has(key)) {
      continue;
    }
    if (allowlist && !allowlist.has(key)) {
      continue;
    }

    const value = changes[key];
    // Nested obje/array'ler (ör. treatment plan items) hâlâ hasta verisi
    // taşıyabilir — bunları da değer olarak değil, sadece varlık olarak işaretle.
    if (isPlainObject(value) || Array.isArray(value)) {
      continue;
    }
    safeValues[key] = value;
  }

  return { changedFieldNames, values: safeValues };
}

module.exports = { sanitizeAuditChanges };
