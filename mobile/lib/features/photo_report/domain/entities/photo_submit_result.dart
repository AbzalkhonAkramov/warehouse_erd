import 'package:equatable/equatable.dart';

/// Outcome of submitting a photo report. The backend always persists the report
/// but [status] tells us whether it actually reached the Telegram topic.
class PhotoSubmitResult extends Equatable {
  const PhotoSubmitResult({required this.status, this.error});

  final String status; // sent | failed | pending
  final String? error;

  bool get sent => status == 'sent';

  @override
  List<Object?> get props => [status, error];
}
