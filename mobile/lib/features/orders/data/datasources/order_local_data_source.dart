import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../domain/entities/pending_order.dart';

/// Persists the offline order outbox in SharedPreferences (a JSON list). Small
/// and few by nature, so no database is needed.
class OrderLocalDataSource {
  static const _key = 'pending_orders';

  Future<List<PendingOrder>> getAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    final list = json.decode(raw) as List<dynamic>;
    return list
        .map((e) => PendingOrder.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> _save(List<PendingOrder> orders) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      json.encode(orders.map((o) => o.toJson()).toList()),
    );
  }

  Future<void> add(PendingOrder order) async {
    final all = await getAll()..add(order);
    await _save(all);
  }

  Future<void> remove(String localId) async {
    final all = await getAll();
    all.removeWhere((o) => o.localId == localId);
    await _save(all);
  }

  Future<int> count() async => (await getAll()).length;
}
