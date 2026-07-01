import 'package:flutter/material.dart';

import 'app.dart';
import 'core/di/injection.dart';
import 'l10n/messages.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadMessages(); // load JSON translations before the first frame
  configureDependencies();
  runApp(const AgentApp());
}
