import 'package:flutter/material.dart';

import 'app.dart';
import 'core/di/injection.dart';
import 'core/server_config.dart';
import 'l10n/messages.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await loadMessages(); // load JSON translations before the first frame
  await ServerConfig.load(); // apply a saved API base URL before the API client
  configureDependencies();
  runApp(const AgentApp());
}
