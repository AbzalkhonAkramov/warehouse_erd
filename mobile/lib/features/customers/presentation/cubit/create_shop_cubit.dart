import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../domain/repositories/customer_repository.dart';

part 'create_shop_state.dart';

class CreateShopCubit extends Cubit<CreateShopState> {
  CreateShopCubit(this._repository) : super(const CreateShopState());

  final CustomerRepository _repository;

  Future<void> submit({
    required String name,
    String? phone,
    String? address,
  }) async {
    emit(state.copyWith(status: CreateShopStatus.submitting));
    try {
      await _repository.createCustomer(name: name, phone: phone, address: address);
      emit(state.copyWith(status: CreateShopStatus.success));
    } on ApiException catch (e) {
      emit(state.copyWith(status: CreateShopStatus.error, error: e.message));
    }
  }
}
