import 'dart:io' show Platform;

import 'package:flutter_test/flutter_test.dart';
import 'package:agent_app/core/config.dart';

void main() {
  test('baseUrl targets the right host per platform and ends with /api/v1', () {
    expect(AppConfig.baseUrl, endsWith('/api/v1'));
    // Android emulator uses 10.0.2.2; everything else (incl. iOS Simulator and
    // the macOS test host) uses localhost.
    final expectedHost = Platform.isAndroid ? '10.0.2.2' : 'localhost';
    expect(AppConfig.baseUrl, contains(expectedHost));
  });

  test('uploadUrl strips /api/v1 and appends the path', () {
    expect(AppConfig.originUrl, isNot(contains('/api/v1')));
    expect(AppConfig.uploadUrl('photos/x.jpg'), endsWith('/uploads/photos/x.jpg'));
  });
}
