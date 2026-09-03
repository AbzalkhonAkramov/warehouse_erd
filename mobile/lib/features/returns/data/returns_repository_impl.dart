import '../domain/repositories/returns_repository.dart';
import 'returns_remote_data_source.dart';

class ReturnsRepositoryImpl implements ReturnsRepository {
  ReturnsRepositoryImpl(this._remote);

  final ReturnsRemoteDataSource _remote;

  @override
  Future<void> submitReturn({
    required int salesOrderId,
    required List<({int productId, double quantity})> lines,
    String? note,
  }) =>
      _remote.submitReturn(salesOrderId: salesOrderId, lines: lines, note: note);
}
