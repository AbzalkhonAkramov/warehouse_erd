import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../domain/entities/customer.dart';
import '../../domain/repositories/customer_repository.dart';

part 'customers_state.dart';

class CustomersCubit extends Cubit<CustomersState> {
  CustomersCubit(this._repository) : super(const CustomersState());

  final CustomerRepository _repository;

  Future<void> load() async {
    emit(state.copyWith(status: CustomersStatus.loading));
    try {
      final customers = await _repository.fetchCustomers();
      emit(state.copyWith(status: CustomersStatus.loaded, customers: customers));
    } on ApiException catch (e) {
      emit(state.copyWith(status: CustomersStatus.error, error: e.message));
    }
  }
}
