import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../../core/branding.dart';
import '../../../../core/di/injection.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../../customers/domain/repositories/customer_repository.dart';
import '../../domain/entities/order.dart';
import '../../domain/repositories/order_repository.dart';
import 'orders_page.dart';

class ReceiptPage extends StatefulWidget {
  const ReceiptPage({super.key, required this.orderId});

  final int orderId;

  @override
  State<ReceiptPage> createState() => _ReceiptPageState();
}

class _ReceiptPageState extends State<ReceiptPage> {
  Order? _order;
  String? _customer;
  CompanyInfo? _company;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final order = await sl<OrderRepository>().getOrder(widget.orderId);
      final customers = await sl<CustomerRepository>().fetchCustomers();
      final company = await sl<BrandingService>().fetch();
      final match = customers.where((c) => c.id == order.customerId);
      if (!mounted) return;
      setState(() {
        _order = order;
        _customer = match.isEmpty ? null : match.first.name;
        _company = company;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Map<String, String> _labels() => {
        'receipt': context.tr('receipt.title'),
        'order': context.tr('receipt.order'),
        'invoice': context.tr('receipt.invoice'),
        'date': context.tr('col.created'),
        'status': context.tr('common.status'),
        'customer': context.tr('receipt.customer'),
        'deliverer': context.tr('receipt.deliverer'),
        'product': context.tr('col.product'),
        'qty': context.tr('col.qty'),
        'unit': context.tr('col.unitPrice'),
        'lineTotal': context.tr('col.lineTotal'),
        'subtotal': context.tr('receipt.subtotal'),
        'discount': context.tr('receipt.discount'),
        'total': context.tr('order.total'),
        'statusLabel': context.tr('status.${_order!.status}'),
      };

  Future<Uint8List> _buildPdf() async {
    final o = _order!;
    final company = _company!;
    final l = _labels();
    final df = DateFormat('d MMM yyyy, HH:mm');

    pw.ImageProvider? logo;
    final logoUrl = company.absoluteLogoUrl;
    if (company.showLogo &&
        logoUrl != null &&
        !logoUrl.toLowerCase().endsWith('.svg')) {
      try {
        logo = await networkImage(logoUrl);
      } catch (_) {/* fall back to text */}
    }

    final doc = pw.Document();
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (ctx) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                if (logo != null)
                  pw.Image(logo, height: 40)
                else if (company.showName)
                  pw.Text(company.name,
                      style: pw.TextStyle(
                          fontSize: 18, fontWeight: pw.FontWeight.bold)),
                pw.Text(l['receipt']!,
                    style: pw.TextStyle(
                        fontSize: 14, fontWeight: pw.FontWeight.bold)),
              ],
            ),
            if (logo != null && company.showName)
              pw.Padding(
                  padding: const pw.EdgeInsets.only(top: 4),
                  child: pw.Text(company.name,
                      style: pw.TextStyle(
                          fontSize: 14, fontWeight: pw.FontWeight.bold))),
            pw.Divider(),
            pw.Text('${l['order']}: #${o.orderNo}'),
            if (o.invoiceNumber != null)
              pw.Text('${l['invoice']}: ${o.invoiceNumber}'),
            pw.Text('${l['date']}: ${df.format(o.createdAt)}'),
            pw.Text('${l['status']}: ${l['statusLabel']}'),
            pw.Text('${l['customer']}: ${_customer ?? '#${o.customerId}'}'),
            if (o.deliverer != null) pw.Text('${l['deliverer']}: ${o.deliverer}'),
            pw.SizedBox(height: 12),
            pw.TableHelper.fromTextArray(
              headers: [l['product']!, l['qty']!, l['unit']!, l['lineTotal']!],
              data: o.lines
                  .map((x) => [
                        x.productName,
                        x.quantity.toStringAsFixed(0),
                        x.unitPrice.toStringAsFixed(2),
                        x.lineTotal.toStringAsFixed(2),
                      ])
                  .toList(),
              headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold),
              cellAlignments: {
                1: pw.Alignment.centerRight,
                2: pw.Alignment.centerRight,
                3: pw.Alignment.centerRight,
              },
            ),
            pw.SizedBox(height: 12),
            pw.Align(
              alignment: pw.Alignment.centerRight,
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('${l['subtotal']}: ${o.subtotal.toStringAsFixed(2)}'),
                  pw.Text('${l['discount']}: ${o.discount.toStringAsFixed(2)}'),
                  pw.Text('${l['total']}: ${o.total.toStringAsFixed(2)}',
                      style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold, fontSize: 14)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
    return doc.save();
  }

  Future<void> _export() async {
    final bytes = await _buildPdf();
    await Printing.layoutPdf(onLayout: (_) async => bytes);
  }

  Future<void> _share() async {
    final bytes = await _buildPdf();
    await Printing.sharePdf(bytes: bytes, filename: 'receipt-${_order!.orderNo}.pdf');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
            _order == null ? context.tr('receipt.title') : '${context.tr('receipt.title')} · #${_order!.orderNo}'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!))
              : _ReceiptBody(order: _order!, customer: _customer, company: _company!),
      bottomNavigationBar: _loading || _error != null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _export,
                        icon: const Icon(Icons.picture_as_pdf),
                        label: Text(context.tr('receipt.export')),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _share,
                        icon: const Icon(Icons.share),
                        label: Text(context.tr('receipt.share')),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _ReceiptBody extends StatelessWidget {
  const _ReceiptBody({required this.order, this.customer, required this.company});

  final Order order;
  final String? customer;
  final CompanyInfo company;

  @override
  Widget build(BuildContext context) {
    final df = DateFormat('d MMM yyyy, HH:mm');
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            if (company.showLogo && company.absoluteLogoUrl != null)
              Image.network(company.absoluteLogoUrl!,
                  height: 40,
                  errorBuilder: (_, __, ___) => Text(company.name,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)))
            else
              Text(company.name,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.bold)),
            Chip(
              label: Text(context.tr('status.${order.status}')),
              backgroundColor: statusColor(order.status).withValues(alpha: 0.15),
            ),
          ],
        ),
        const Divider(),
        _row(context.tr('receipt.order'), '#${order.orderNo}'),
        if (order.invoiceNumber != null)
          _row(context.tr('receipt.invoice'), order.invoiceNumber!),
        _row(context.tr('col.created'), df.format(order.createdAt)),
        _row(context.tr('receipt.customer'), customer ?? '#${order.customerId}'),
        _row(context.tr('receipt.deliverer'), order.deliverer ?? '—'),
        const SizedBox(height: 12),
        ...order.lines.map((l) => ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              title: Text(l.productName),
              subtitle: Text(
                  '${l.quantity.toStringAsFixed(0)} × ${l.unitPrice.toStringAsFixed(2)}'),
              trailing: Text(l.lineTotal.toStringAsFixed(2)),
            )),
        const Divider(),
        _row(context.tr('receipt.subtotal'), order.subtotal.toStringAsFixed(2)),
        _row(context.tr('receipt.discount'), order.discount.toStringAsFixed(2)),
        Align(
          alignment: Alignment.centerRight,
          child: Text('${context.tr('order.total')}: ${order.total.toStringAsFixed(2)}',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(color: Colors.grey)),
            Flexible(child: Text(value, textAlign: TextAlign.right)),
          ],
        ),
      );
}
