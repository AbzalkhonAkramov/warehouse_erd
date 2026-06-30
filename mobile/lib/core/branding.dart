import 'config.dart';
import 'network/api_client.dart';

class CompanyInfo {
  const CompanyInfo({required this.name, this.logoUrl, this.displayMode = 'both'});

  final String name;
  final String? logoUrl; // relative ("/uploads/...") or absolute
  final String displayMode; // text | logo | both

  bool get showLogo => displayMode != 'text' && (logoUrl?.isNotEmpty ?? false);
  bool get showName => displayMode == 'text' || displayMode == 'both' || !showLogo;

  /// Absolute logo URL (the API returns a "/uploads/..." path).
  String? get absoluteLogoUrl {
    final u = logoUrl;
    if (u == null || u.isEmpty) return null;
    if (u.startsWith('http')) return u;
    return '${AppConfig.originUrl}$u';
  }
}

class BrandingService {
  BrandingService(this._client);

  final ApiClient _client;

  Future<CompanyInfo> fetch() async {
    final j = await _client.get('/meta/company') as Map<String, dynamic>;
    return CompanyInfo(
      name: (j['name'] as String?) ?? 'Warehouse ERP',
      logoUrl: j['logo_url'] as String?,
      displayMode: (j['display_mode'] as String?) ?? 'both',
    );
  }
}
