part of 'create_shop_cubit.dart';

enum CreateShopStatus { idle, submitting, success, error }

class CreateShopState extends Equatable {
  const CreateShopState({
    this.status = CreateShopStatus.idle,
    this.regions = const [],
    this.error,
  });

  final CreateShopStatus status;
  final List<Region> regions;
  final String? error;

  CreateShopState copyWith({
    CreateShopStatus? status,
    List<Region>? regions,
    String? error,
  }) {
    return CreateShopState(
      status: status ?? this.status,
      regions: regions ?? this.regions,
      error: error,
    );
  }

  @override
  List<Object?> get props => [status, regions, error];
}
