#!/usr/bin/env node
/**
 * Demo veri seed scripti:
 * - Birkaç yeni doktor (farklı uzmanlıklar)
 * - 100 hasta (2025 Ekim - bugün arası rastgele kayıt tarihi)
 * - Her hastaya tedavi planı (bir kısmı tamamlanmış, bir kısmı devam ediyor)
 * - Ödemeler (bitenlerin çoğu ödenmiş, devam edenlerin bir kısmı ödenmiş)
 * - Bir kısmına önümüzdeki 15 güne randevu
 */
require('../src/config');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const logger = require('../src/utils/logger');
const { serializeRolesCsv } = require('../src/utils/roles');

const TRY = 'TRY';

const FIRST_NAMES = [
  'Ahmet', 'Mehmet', 'Ali', 'Mustafa', 'Hüseyin', 'Hasan', 'İbrahim', 'İsmail', 'Osman', 'Yusuf',
  'Emre', 'Burak', 'Can', 'Eren', 'Kerem', 'Onur', 'Serkan', 'Tolga', 'Volkan', 'Barış',
  'Ayşe', 'Fatma', 'Emine', 'Hatice', 'Zeynep', 'Elif', 'Merve', 'Selin', 'Deniz', 'Ceren',
  'Esra', 'Gamze', 'Özlem', 'Pınar', 'Seda', 'Tuğba', 'Yeliz', 'Derya', 'Burcu', 'Aslı',
];

const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir',
  'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek',
  'Polat', 'Korkmaz', 'Güneş', 'Bozkurt', 'Tekin', 'Erdoğan', 'Aksoy', 'Güler', 'Acar', 'Bulut',
];

const TREATMENT_TYPES = [
  'Dolgu', 'Kanal Tedavisi', 'Diş Çekimi', 'Temizlik', 'İmplant', 'Kuron', 'Köprü',
  'Ortodonti', 'Diş Beyazlatma', 'Apse Tedavisi', 'Gingivektomi', 'Kemik Grefti',
];

const SPECIALIZATIONS = ['Genel', 'İmplantoloji', 'Ortodonti', 'Periodontoloji', 'Endodonti'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function randomDate(start, end) {
  const s = start.getTime();
  const e = end.getTime();
  return new Date(s + Math.random() * (e - s));
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function formatTime(d) {
  return d.toTimeString().slice(0, 5);
}

async function run() {
  const client = await pool.connect();
  try {
    logger.info('Seed demo data başlıyor...');

    const passwordHash = await bcrypt.hash('Demo123!', 10);
    const rolesCsv = serializeRolesCsv(['dentist']);

    const newDoctors = [
      { email: 'dr.genel@demo.com', firstName: 'Selim', lastName: 'Genel', spec: 'Genel' },
      { email: 'dr.implant@demo.com', firstName: 'Cem', lastName: 'Implant', spec: 'İmplantoloji' },
      { email: 'dr.ortodonti@demo.com', firstName: 'Ece', lastName: 'Ortodonti', spec: 'Ortodonti' },
      { email: 'dr.periodont@demo.com', firstName: 'Berk', lastName: 'Periodont', spec: 'Periodontoloji' },
      { email: 'dr.endodont@demo.com', firstName: 'Selin', lastName: 'Endodont', spec: 'Endodonti' },
    ];

    const dentistIds = [];

    for (const d of newDoctors) {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [d.email]);
      if (existing.rows.length > 0) {
        dentistIds.push(existing.rows[0].id);
        continue;
      }
      const r = await client.query(
        `INSERT INTO users (email, password_hash, roles, first_name, last_name, specializations, commission_rate, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 30, NOW(), NOW()) RETURNING id`,
        [d.email, passwordHash, rolesCsv, d.firstName, d.lastName, d.spec],
      );
      dentistIds.push(r.rows[0].id);
    }

    const existingDentists = await client.query(
      "SELECT id FROM users WHERE roles LIKE '%dentist%' AND deleted_at IS NULL",
    );
    const allDentistIds = [...new Set(existingDentists.rows.map((r) => r.id).concat(dentistIds))];
    if (allDentistIds.length === 0) {
      throw new Error('En az bir doktor olmalı');
    }
    logger.info({ count: allDentistIds.length }, 'Doktorlar hazır');

    const oct2025 = new Date(2025, 9, 1);
    const now = new Date();

    const patientIds = [];
    for (let i = 0; i < 100; i++) {
      const firstName = randomChoice(FIRST_NAMES);
      const lastName = randomChoice(LAST_NAMES);
      const createdAt = randomDate(oct2025, now);
      const birthYear = 1950 + randomInt(0, 45);
      const gender = randomChoice(['Erkek', 'Kadın']);
      const phone = `05${randomInt(3, 5)}${randomInt(1000000, 9999999)}`;
      const email = `hasta${i + 1}@demo.com`;

      const r = await client.query(
        `INSERT INTO patients (first_name, last_name, date_of_birth, gender, email, phone, city, country, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'İstanbul', 'Türkiye', $7, $8) RETURNING id`,
        [
          firstName,
          lastName,
          `${birthYear}-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`,
          gender,
          email,
          phone,
          createdAt,
          createdAt,
        ],
      );
      patientIds.push(r.rows[0].id);
    }
    logger.info({ count: patientIds.length }, 'Hastalar oluşturuldu');

    const planCompletedRatio = 0.6;
    const startDateMin = new Date(2025, 9, 1);
    const startDateMax = new Date(2026, 0, 15);

    for (let i = 0; i < patientIds.length; i++) {
      const patientId = patientIds[i];
      const dentistId = randomChoice(allDentistIds);
      const isCompleted = Math.random() < planCompletedRatio;
      const startDate = randomDate(startDateMin, startDateMax);
      const numItems = randomInt(2, 5);
      let totalCost = 0;
      const itemCosts = [];
      for (let k = 0; k < numItems; k++) {
        const cost = randomInt(200, 1500);
        itemCosts.push(cost);
        totalCost += cost;
      }

      const status = isCompleted ? 'completed' : 'active';
      const actualCompletionDate = isCompleted ? randomDate(startDate, now) : null;

      const planResult = await client.query(
        `INSERT INTO treatment_plans (patient_id, dentist_id, title, description, status, total_estimated_cost, currency, start_date, actual_completion_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [
          patientId,
          dentistId,
          `Tedavi Planı ${i + 1}`,
          'Demo tedavi planı',
          status,
          totalCost,
          TRY,
          formatDate(startDate),
          actualCompletionDate ? formatDate(actualCompletionDate) : null,
          startDate,
          actualCompletionDate || now,
        ],
      );
      const planId = planResult.rows[0].id;

      const toothNumbers = ['11', '12', '21', '22', '16', '26', '31', '32', '36', '46'];
      for (let k = 0; k < numItems; k++) {
        const itemStatus = isCompleted ? 'completed' : (k < numItems - 1 ? 'completed' : 'in_progress');
        await client.query(
          `INSERT INTO treatment_plan_items (treatment_plan_id, tooth_number, treatment_type, cost, currency, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            planId,
            toothNumbers[k % toothNumbers.length],
            randomChoice(TREATMENT_TYPES),
            itemCosts[k],
            TRY,
            itemStatus,
          ],
        );
      }

      const paidRatio = isCompleted
        ? 0.9 + Math.random() * 0.1
        : Math.random() * 0.8;
      const paidAmount = Math.round(totalCost * paidRatio * 100) / 100;
      const remainingDebt = Math.max(0, Math.round((totalCost - paidAmount) * 100) / 100);

      await client.query(
        `INSERT INTO patient_debts (patient_id, total_debt, paid_amount, remaining_debt, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (patient_id) DO UPDATE SET
           total_debt = patient_debts.total_debt + $2,
           paid_amount = patient_debts.paid_amount + $3,
           remaining_debt = patient_debts.remaining_debt + $4,
           updated_at = NOW()`,
        [patientId, totalCost, paidAmount, totalCost - paidAmount],
      );

      if (paidAmount > 0) {
        const pay1 = Math.round(paidAmount * 0.6 * 100) / 100;
        const pay2 = Math.round((paidAmount - pay1) * 100) / 100;
        const methods = ['Kart', 'Nakit'];
        const d1 = randomDate(startDate, now);
        const d2 = pay2 > 0 ? randomDate(d1, now) : d1;
        await client.query(
          `INSERT INTO payments (patient_id, treatment_plan_id, amount, payment_method, dentist_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [patientId, planId, pay1, randomChoice(methods), dentistId, d1, d1],
        );
        if (pay2 > 0) {
          await client.query(
            `INSERT INTO payments (patient_id, treatment_plan_id, amount, payment_method, dentist_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [patientId, planId, pay2, randomChoice(methods), dentistId, d2, d2],
          );
        }
      }
    }
    logger.info('Tedavi planları ve ödemeler oluşturuldu');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in15Days = new Date(today);
    in15Days.setDate(in15Days.getDate() + 15);

    const appointmentPatientIndices = new Set();
    while (appointmentPatientIndices.size < 38) {
      appointmentPatientIndices.add(randomInt(0, patientIds.length - 1));
    }

    const slots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    for (const idx of appointmentPatientIndices) {
      const patientId = patientIds[idx];
      const appointmentDate = randomDate(tomorrow, in15Days);
      const startTime = randomChoice(slots);
      const [h, m] = startTime.split(':').map(Number);
      const endDate = new Date(appointmentDate);
      endDate.setHours(h + 1, m, 0, 0);
      const dentistId = randomChoice(allDentistIds);
      const types = ['checkup', 'cleaning', 'filling', 'extraction', 'kontrol'];
      await client.query(
        `INSERT INTO appointments (patient_id, dentist_id, appointment_date, start_time, end_time, status, appointment_type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, NOW(), NOW())`,
        [
          patientId,
          dentistId,
          formatDate(appointmentDate),
          startTime,
          formatTime(endDate),
          randomChoice(types),
        ],
      );
    }
    logger.info({ count: appointmentPatientIndices.size }, 'Randevular oluşturuldu');

    logger.info('Demo veri seed tamamlandı.');
  } catch (err) {
    logger.error({ err }, 'Seed hatası');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
