import 'package:flutter/material.dart';

import '../config.dart';
import '../di/injection.dart';
import '../network/api_client.dart';
import '../server_config.dart';
import '../theme/app_colors.dart';
import '../../l10n/l10n_ext.dart';

/// Lets the user point the app at a specific backend (persisted). Fixes cases
/// where the default emulator host isn't reachable.
Future<void> showServerUrlDialog(BuildContext context) async {
  final controller = TextEditingController(
    text: AppConfig.hasRuntimeBase ? AppConfig.baseUrl : '',
  );
  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(ctx.tr('server.title')),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: controller,
            keyboardType: TextInputType.url,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: ctx.tr('server.url'),
              hintText: AppConfig.defaultBase,
            ),
          ),
          const SizedBox(height: 10),
          Text(ctx.tr('server.hint'),
              style: const TextStyle(fontSize: 12, color: AppColors.neutral)),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text(ctx.tr('common.cancel')),
        ),
        FilledButton(
          onPressed: () async {
            await ServerConfig.save(controller.text);
            sl<ApiClient>().setBaseUrl(AppConfig.baseUrl);
            if (ctx.mounted) Navigator.of(ctx).pop();
          },
          child: Text(ctx.tr('common.save')),
        ),
      ],
    ),
  );
}
