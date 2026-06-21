import 'package:agent_app/features/photo_report/domain/entities/photo_submit_result.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PhotoSubmitResult', () {
    test('sent is true only for "sent" status', () {
      expect(const PhotoSubmitResult(status: 'sent').sent, isTrue);
      expect(
        const PhotoSubmitResult(status: 'failed', error: 'x').sent,
        isFalse,
      );
      expect(const PhotoSubmitResult(status: 'pending').sent, isFalse);
    });
  });
}
