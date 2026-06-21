import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'locale_cubit.dart';
import 'messages.dart';

/// `context.tr('key')` — looks up the current language (falling back to Russian,
/// then the key itself) and interpolates `{var}` placeholders.
///
/// Uses `read` (not `watch`) so it is safe inside callbacks; the whole tree is
/// rebuilt by the root `BlocBuilder<LocaleCubit>` when the language changes.
extension L10n on BuildContext {
  String tr(String key, [Map<String, Object?>? vars]) {
    final lang = read<LocaleCubit>().state;
    var str = messages[lang]?[key] ?? messages[AppLang.ru]?[key] ?? key;
    if (vars != null) {
      vars.forEach((k, v) => str = str.replaceAll('{$k}', '$v'));
    }
    return str;
  }
}
