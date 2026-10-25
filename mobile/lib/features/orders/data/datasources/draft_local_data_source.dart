import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../domain/entities/order_draft.dart';

/// Persists order drafts in SharedPreferences (a JSON list), separate from the
/// offline outbox. Drafts are never auto-sent — the agent resumes them manually.
class DraftLocalDataSource {
  static const _key = 'order_drafts';

  Future<List<OrderDraft>> getAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return [];
    final list = json.decode(raw) as List<dynamic>;
    final drafts = list
        .map((e) => OrderDraft.fromJson(e as Map<String, dynamic>))
        .toList();
    // Newest first.
    drafts.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return drafts;
  }

  Future<void> _save(List<OrderDraft> drafts) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      json.encode(drafts.map((d) => d.toJson()).toList()),
    );
  }

  /// Insert a new draft or replace the existing one with the same localId.
  Future<void> upsert(OrderDraft draft) async {
    final all = await getAll();
    all.removeWhere((d) => d.localId == draft.localId);
    all.add(draft);
    await _save(all);
  }

  Future<void> remove(String localId) async {
    final all = await getAll();
    all.removeWhere((d) => d.localId == localId);
    await _save(all);
  }

  Future<int> count() async => (await getAll()).length;
}
