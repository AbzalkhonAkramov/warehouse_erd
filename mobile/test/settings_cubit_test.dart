import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:agent_app/core/settings/settings_cubit.dart';
import 'package:agent_app/l10n/messages.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('showCatalogStock defaults on, toggles and persists', () async {
    SharedPreferences.setMockInitialValues({});
    final cubit = SettingsCubit();
    await cubit.load();
    expect(cubit.state.showCatalogStock, isTrue);

    await cubit.setShowCatalogStock(false);
    expect(cubit.state.showCatalogStock, isFalse);

    // A fresh cubit reads the persisted value back.
    final again = SettingsCubit();
    await again.load();
    expect(again.state.showCatalogStock, isFalse);
  });

  test('settings translations are present in every language', () async {
    await loadMessages();
    for (final lang in AppLang.values) {
      expect(messages[lang]!['settings.showStock'], isNotNull);
      expect(messages[lang]!['settings.title'], isNotNull);
    }
  });
}
