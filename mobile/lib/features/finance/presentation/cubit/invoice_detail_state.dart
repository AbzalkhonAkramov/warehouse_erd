part of 'invoice_detail_cubit.dart';

enum DetailStatus { initial, loading, ready, error }

class InvoiceDetailState extends Equatable {
  const InvoiceDetailState({
    this.status = DetailStatus.initial,
    this.invoice,
    this.submitting = false,
    this.paidJustNow = false,
    this.error,
  });

  final DetailStatus status;
  final Invoice? invoice;
  final bool submitting;
  final bool paidJustNow;
  final String? error;

  InvoiceDetailState copyWith({
    DetailStatus? status,
    Invoice? invoice,
    bool? submitting,
    bool? paidJustNow,
    String? error,
    bool clearMessages = false,
  }) {
    return InvoiceDetailState(
      status: status ?? this.status,
      invoice: invoice ?? this.invoice,
      submitting: submitting ?? this.submitting,
      paidJustNow: clearMessages ? false : (paidJustNow ?? this.paidJustNow),
      error: clearMessages ? null : (error ?? this.error),
    );
  }

  @override
  List<Object?> get props => [status, invoice, submitting, paidJustNow, error];
}
