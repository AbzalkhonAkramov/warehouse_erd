part of 'create_shop_cubit.dart';

enum CreateShopStatus { idle, submitting, success, error }

class CreateShopState extends Equatable {
  const CreateShopState({this.status = CreateShopStatus.idle, this.error});

  final CreateShopStatus status;
  final String? error;

  CreateShopState copyWith({CreateShopStatus? status, String? error}) {
    return CreateShopState(status: status ?? this.status, error: error);
  }

  @override
  List<Object?> get props => [status, error];
}
