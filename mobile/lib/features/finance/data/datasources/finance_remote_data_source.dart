import '../../../../core/network/api_client.dart';
import '../../domain/entities/invoice.dart';

double _toDouble(dynamic v) =>
    v == null ? 0 : (v is num ? v.toDouble() : double.tryParse('$v') ?? 0);

DateTime _toDate(dynamic v) =>
    DateTime.tryParse('${v ?? ''}')?.toLocal() ?? DateTime.now();

Payment _parsePayment(Map<String, dynamic> j) => Payment(
      id: j['id'] as int,
      invoiceId: j['invoice_id'] as int,
      amount: _toDouble(j['amount']),
      method: (j['method'] as String?) ?? 'cash',
      collectedByName: j['collected_by_name'] as String?,
      collectedAt: _toDate(j['collected_at']),
      note: j['note'] as String?,
    );

Invoice _parseInvoice(Map<String, dynamic> j) => Invoice(
      id: j['id'] as int,
      number: (j['number'] as String?) ?? '${j['id']}',
      salesOrderId: j['sales_order_id'] as int,
      customerId: j['customer_id'] as int,
      total: _toDouble(j['total']),
      paidAmount: _toDouble(j['paid_amount']),
      status: (j['status'] as String?) ?? 'unpaid',
      createdAt: _toDate(j['created_at']),
      payments: ((j['payments'] as List<dynamic>?) ?? [])
          .map((p) => _parsePayment(p as Map<String, dynamic>))
          .toList(),
    );

class FinanceRemoteDataSource {
  FinanceRemoteDataSource(this._client);

  final ApiClient _client;

  Future<List<Invoice>> listInvoices() async {
    final data = await _client.get('/invoices') as List<dynamic>;
    return data.map((j) => _parseInvoice(j as Map<String, dynamic>)).toList();
  }

  Future<Invoice> getInvoice(int id) async {
    final data = await _client.get('/invoices/$id') as Map<String, dynamic>;
    return _parseInvoice(data);
  }

  Future<void> recordPayment({
    required int invoiceId,
    required double amount,
    required String method,
    String? note,
  }) async {
    await _client.post('/payments', data: {
      'invoice_id': invoiceId,
      'amount': amount,
      'method': method,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }
}
