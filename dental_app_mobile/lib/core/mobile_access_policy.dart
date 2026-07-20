import '../models/models.dart';

/// Mobil uygulamanın desteklediği iki kullanıcı tipini ve yetkilerini tek
/// noktada tanımlar. Admin backend rolü mobilde "patron" anlamına gelir.
class MobileAccessPolicy {
  final bool isOwner;
  final bool isDentist;

  const MobileAccessPolicy._({
    required this.isOwner,
    required this.isDentist,
  });

  factory MobileAccessPolicy.forUser(User? user) {
    // Bir hesapta iki rol bulunsa bile patronun salt-okunur kuralı önceliklidir.
    final isOwner = user?.isAdmin ?? false;
    return MobileAccessPolicy._(
      isOwner: isOwner,
      isDentist: !isOwner && (user?.isDentist ?? false),
    );
  }

  bool get isSupported => isOwner || isDentist;
  bool get canViewFinancials => isOwner;
  bool get canManageAppointments => isDentist;
  bool get canManagePatients => isDentist;
  bool get canManageTreatments => isDentist;

  String get roleLabel => isOwner ? 'Patron · Salt okunur' : 'Diş Hekimi';
}
