import '../../../../core/network/api_client.dart';
import '../../domain/entities/cash_summary.dart';
import '../../domain/entities/remittance.dart';

double _toDouble(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

DateTime? _toDate(dynamic v) =>
    v == null ? null : DateTime.tryParse('$v')?.toLocal();

class CashRemoteDataSource {
  CashRemoteDataSource(this._client);

  final ApiClient _client;

  Future<CashSummary> fetchSummary() async {
    final j = await _client.get('/cash/summary') as Map<String, dynamic>;
    return CashSummary(
      collected: _toDouble(j['collected']),
      received: _toDouble(j['received']),
      pending: _toDouble(j['pending']),
      outstanding: _toDouble(j['outstanding']),
      available: _toDouble(j['available']),
      mode: (j['mode'] as String?) ?? 'manager_records',
    );
  }

  Future<List<Remittance>> listRemittances() async {
    final data = await _client.get('/cash/remittances') as List<dynamic>;
    return data.map((e) {
      final j = e as Map<String, dynamic>;
      return Remittance(
        id: j['id'] as int,
        amount: _toDouble(j['amount']),
        status: (j['status'] as String?) ?? 'pending',
        createdAt: _toDate(j['created_at']) ?? DateTime.now(),
        receivedAt: _toDate(j['received_at']),
        receivedByName: j['received_by_name'] as String?,
        note: j['note'] as String?,
      );
    }).toList();
  }

  Future<void> submitHandover({required double amount, String? note}) async {
    await _client.post('/cash/submit', data: {
      'amount': amount,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }
}
