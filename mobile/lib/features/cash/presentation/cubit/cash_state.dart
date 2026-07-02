part of 'cash_cubit.dart';

enum CashStatus { initial, loading, ready, error }

class CashState extends Equatable {
  const CashState({
    this.status = CashStatus.initial,
    this.summary,
    this.history = const [],
    this.submitting = false,
    this.error,
  });

  final CashStatus status;
  final CashSummary? summary;
  final List<Remittance> history;
  final bool submitting;
  final String? error;

  CashState copyWith({
    CashStatus? status,
    CashSummary? summary,
    List<Remittance>? history,
    bool? submitting,
    String? error,
    bool clearError = false,
  }) {
    return CashState(
      status: status ?? this.status,
      summary: summary ?? this.summary,
      history: history ?? this.history,
      submitting: submitting ?? this.submitting,
      error: clearError ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [status, summary, history, submitting, error];
}
