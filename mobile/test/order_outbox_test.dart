import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:agent_app/core/network/api_exception.dart';
import 'package:agent_app/features/orders/data/datasources/order_local_data_source.dart';
import 'package:agent_app/features/orders/data/datasources/order_remote_data_source.dart';
import 'package:agent_app/features/orders/data/repositories/order_repository_impl.dart';
import 'package:agent_app/features/orders/domain/entities/order.dart';
import 'package:agent_app/features/orders/domain/entities/order_line_input.dart';

/// Fake remote that can be toggled offline, or made to reject with a server error.
class _FakeRemote implements OrderRemoteDataSource {
  _FakeRemote({this.online = true, this.serverError = false});
  bool online;
  bool serverError;
  final List<int> created = [];

  @override
  Future<({int id, String status})> createOrder({
    required int customerId,
    required List<OrderLineInput> lines,
    String? note,
  }) async {
    if (!online) throw const ApiException('offline', isNetwork: true);
    if (serverError) throw const ApiException('bad request', statusCode: 400);
    created.add(customerId);
    return (id: created.length, status: 'new');
  }

  @override
  Future<List<Order>> listOrders() async => const [];

  @override
  Future<Order> getOrder(int id) => throw UnimplementedError();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('offline order is queued, then sent when back online', () async {
    final remote = _FakeRemote(online: false);
    final repo = OrderRepositoryImpl(remote, OrderLocalDataSource());

    final res = await repo.submitOrder(
      customerId: 7,
      lines: [const OrderLineInput(productId: 2, quantity: 3)],
    );
    expect(res.queued, isTrue);
    expect(await repo.pendingCount(), 1);
    expect(remote.created, isEmpty);

    // Back online → drain.
    remote.online = true;
    final sync = await repo.syncPending();
    expect(sync.synced, 1);
    expect(sync.stillOffline, isFalse);
    expect(await repo.pendingCount(), 0);
    expect(remote.created, [7]);
  });

  test('online order is sent immediately (not queued)', () async {
    final remote = _FakeRemote(online: true);
    final repo = OrderRepositoryImpl(remote, OrderLocalDataSource());

    final res = await repo.submitOrder(
      customerId: 5,
      lines: [const OrderLineInput(productId: 1, quantity: 1)],
    );
    expect(res.queued, isFalse);
    expect(res.id, isNotNull);
    expect(await repo.pendingCount(), 0);
  });

  test('server error surfaces immediately and is not queued', () async {
    final remote = _FakeRemote(online: true, serverError: true);
    final repo = OrderRepositoryImpl(remote, OrderLocalDataSource());

    expect(
      () => repo.submitOrder(
        customerId: 5,
        lines: [const OrderLineInput(productId: 1, quantity: 1)],
      ),
      throwsA(isA<ApiException>()),
    );
    expect(await repo.pendingCount(), 0);
  });
}
