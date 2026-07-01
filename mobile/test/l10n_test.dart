import 'package:flutter_test/flutter_test.dart';
import 'package:agent_app/l10n/messages.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('loadMessages fills every language from JSON assets', () async {
    await loadMessages();

    for (final lang in AppLang.values) {
      expect(messages[lang], isNotEmpty, reason: '${lang.name} should load');
    }
    // A known key resolves per language.
    expect(messages[AppLang.en]!['common.signOut'], 'Sign out');
    expect(messages[AppLang.ru]!['common.signOut'], isNotNull);
    // Interpolation placeholders are preserved for context.tr to fill.
    expect(messages[AppLang.en]!['order.sent'], contains('{id}'));
    // The finance keys added earlier are present.
    expect(messages[AppLang.ru]!['tab.finance'], isNotNull);
  });
}
