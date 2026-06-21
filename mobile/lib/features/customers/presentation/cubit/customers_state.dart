part of 'customers_cubit.dart';

enum CustomersStatus { initial, loading, loaded, error }

class CustomersState extends Equatable {
  const CustomersState({
    this.status = CustomersStatus.initial,
    this.customers = const [],
    this.error,
  });

  final CustomersStatus status;
  final List<Customer> customers;
  final String? error;

  CustomersState copyWith({
    CustomersStatus? status,
    List<Customer>? customers,
    String? error,
  }) {
    return CustomersState(
      status: status ?? this.status,
      customers: customers ?? this.customers,
      error: error,
    );
  }

  @override
  List<Object?> get props => [status, customers, error];
}
