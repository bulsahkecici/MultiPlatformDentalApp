const { AppError } = require('./errorResponder');
const { isDentist, isAdmin } = require('../middlewares/auth');

/**
 * Randevu/tedavi/tedavi planı oluştururken hangi dişhekimi adına kayıt
 * açılacağını tek bir noktadan belirler.
 *
 * - Diş hekimi rolündeki bir kullanıcı `dentistId` göndermezse kendi ID'si
 *   kullanılır; kendi ID'sinden FARKLI bir `dentistId` gönderirse istek
 *   reddedilir (403) — aksi halde bir dişhekimi başka bir doktor adına
 *   randevu/tedavi/plan oluşturup o doktorun kaydını devralabilirdi.
 * - Sekreter/admin geçerli bir `dentistId` seçebilir, ancak seçilen
 *   kullanıcının gerçekten aktif (silinmemiş) bir 'dentist' rolü taşıdığı
 *   veritabanından doğrulanır — rolü olmayan ya da silinmiş bir kullanıcı
 *   "doktor" olarak atanamaz.
 * - `dentistId` hiç gönderilmemişse ve istek sahibi dişhekimi değilse (ör.
 *   sekreter dişhekimsiz bir randevu/tedavi girmek istiyorsa) null döner;
 *   çağıran taraf bunun kendi iş kuralına göre kabul edilip edilmeyeceğine
 *   karar verir (şu an tüm çağrı noktaları null'ı serbestçe kabul ediyor).
 *
 * @param {object} req - Express request (req.user, req.body üzerinden okunur)
 * @param {import('../db')['query']} queryFn - aktif dentist rolü kontrolü için
 * @param {number|string|null|undefined} requestedDentistId
 * @returns {Promise<number|null>}
 */
async function resolveEffectiveDentistId(req, queryFn, requestedDentistId) {
  if (isDentist(req)) {
    if (
      requestedDentistId === undefined ||
      requestedDentistId === null ||
      requestedDentistId === ''
    ) {
      return req.user.sub;
    }
    if (!isAdmin(req) && Number(requestedDentistId) !== Number(req.user.sub)) {
      throw new AppError(
        'Dentists cannot create or take over records on behalf of another dentist',
        403,
      );
    }
    if (Number(requestedDentistId) === Number(req.user.sub)) {
      return req.user.sub;
    }
  }

  if (
    requestedDentistId === undefined ||
    requestedDentistId === null ||
    requestedDentistId === ''
  ) {
    return null;
  }

  const dentistId = parseInt(requestedDentistId, 10);
  if (!Number.isFinite(dentistId)) {
    throw new AppError('Invalid dentistId', 400);
  }

  const result = await queryFn(
    "SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL AND roles LIKE '%dentist%'",
    [dentistId],
  );
  if (result.rows.length === 0) {
    throw new AppError(
      'Selected dentistId does not belong to an active dentist',
      400,
    );
  }

  return dentistId;
}

module.exports = { resolveEffectiveDentistId };
