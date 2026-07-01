part of 'invoices_cubit.dart';

enum InvoicesStatus { initial, loading, ready, error }

enum InvoiceFilter { unpaid, all }

class InvoicesState extends Equatable {
  const InvoicesState({
    this.status = InvoicesStatus.initial,
    this.invoices = const [],
    this.customerNames = const {},
    this.filter = InvoiceFilter.unpaid,
    this.error,
  });

  final InvoicesStatus status;
  final List<Invoice> invoices;
  final Map<int, String> customerNames;
  final InvoiceFilter filter;
  final String? error;

  /// Invoices after applying the current filter (newest first from the API).
  List<Invoice> get visible => filter == InvoiceFilter.all
      ? invoices
      : invoices.where((i) => !i.isPaid).toList();

  /// Total amount still outstanding across ALL invoices (the collection target).
  double get totalOutstanding =>
      invoices.fold(0.0, (sum, i) => sum + i.balance);

  InvoicesState copyWith({
    InvoicesStatus? status,
    List<Invoice>? invoices,
    Map<int, String>? customerNames,
    InvoiceFilter? filter,
    String? error,
  }) {
    return InvoicesState(
      status: status ?? this.status,
      invoices: invoices ?? this.invoices,
      customerNames: customerNames ?? this.customerNames,
      filter: filter ?? this.filter,
      error: error,
    );
  }

  @override
  List<Object?> get props => [status, invoices, customerNames, filter, error];
}
