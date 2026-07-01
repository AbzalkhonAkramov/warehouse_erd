import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/di/injection.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../l10n/l10n_ext.dart';
import '../bloc/photo_report_bloc.dart';

class PhotoReportPage extends StatelessWidget {
  const PhotoReportPage({
    super.key,
    this.initialCustomerId,
    this.initialSalesOrderId,
    this.lockSelection = false,
    this.standalone = false,
  });

  /// When launched from a specific order, the customer + order are pre-pinned
  /// and (if [lockSelection]) cannot be changed on screen.
  final int? initialCustomerId;
  final int? initialSalesOrderId;
  final bool lockSelection;

  /// When true the page provides its own Scaffold/AppBar (pushed as a route);
  /// inside the home tab it is hosted by the home Scaffold instead.
  final bool standalone;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<PhotoReportBloc>()
        ..add(PhotoInitRequested(
          initialCustomerId: initialCustomerId,
          initialSalesOrderId: initialSalesOrderId,
          locked: lockSelection,
        )),
      child: standalone
          ? Scaffold(
              appBar: AppBar(title: Text(context.tr('photo.title'))),
              body: const _PhotoReportView(),
            )
          : const _PhotoReportView(),
    );
  }
}

class _PhotoReportView extends StatelessWidget {
  const _PhotoReportView();

  Future<void> _pick(BuildContext context, bool isBefore) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70,
      maxWidth: 1600,
    );
    if (file == null || !context.mounted) return;
    final bloc = context.read<PhotoReportBloc>();
    if (isBefore) {
      bloc.add(PhotoBeforePicked(file.path));
    } else {
      bloc.add(PhotoAfterPicked(file.path));
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<PhotoReportBloc, PhotoReportState>(
      listenWhen: (p, c) => p.status != c.status,
      listener: (context, state) {
        if (state.status == PhotoStatus.success) {
          final r = state.result!;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: r.sent ? Colors.green : Colors.orange,
              content: Text(r.sent
                  ? context.tr('photo.sentOk')
                  : context.tr('photo.sentFail', {'error': r.error ?? 'unknown'})),
            ),
          );
          // Pinned-from-order flow: pop back to the order once submitted.
          if (state.locked && Navigator.of(context).canPop()) {
            Navigator.of(context).pop();
          } else {
            context.read<PhotoReportBloc>().add(const PhotoInitRequested());
          }
        } else if (state.status == PhotoStatus.error && state.error != null) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text(state.error!)));
        }
      },
      builder: (context, state) {
        if (state.status == PhotoStatus.loading ||
            state.status == PhotoStatus.initial) {
          return const LoadingView();
        }
        final bloc = context.read<PhotoReportBloc>();
        final submitting = state.status == PhotoStatus.submitting;
        final orders = state.ordersForCustomer;
        return RefreshIndicator(
          onRefresh: () async {
            final done = bloc.stream.first; // resolves on the reload's emit
            bloc.add(const PhotoReloaded());
            await done.timeout(const Duration(seconds: 6),
                onTimeout: () => bloc.state);
          },
          child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            DropdownButtonFormField<int>(
              initialValue: state.customerId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: context.tr('photo.customer'),
              ),
              items: state.customers
                  .map((c) =>
                      DropdownMenuItem(value: c.id, child: Text(c.name)))
                  .toList(),
              onChanged: state.locked
                  ? null
                  : (id) => id == null ? null : bloc.add(PhotoCustomerSelected(id)),
            ),
            const SizedBox(height: 14),
            // Pin the report to a specific order (so it shows on the order).
            DropdownButtonFormField<int?>(
              initialValue: state.salesOrderId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: context.tr('photo.order'),
                helperText: context.tr('photo.orderHelp'),
              ),
              items: [
                DropdownMenuItem<int?>(
                    value: null, child: Text(context.tr('photo.noOrder'))),
                ...orders.map(
                  (o) => DropdownMenuItem<int?>(
                    value: o.id,
                    child: Text('#${o.orderNo} · ${context.tr('status.${o.status}')}'),
                  ),
                ),
              ],
              onChanged: (state.locked || state.customerId == null)
                  ? null
                  : (id) => bloc.add(PhotoOrderSelected(id)),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<int?>(
              initialValue: state.topicId,
              isExpanded: true,
              decoration: InputDecoration(
                labelText: context.tr('photo.topic'),
                helperText: context.tr('photo.topicHelp'),
              ),
              items: [
                DropdownMenuItem<int?>(
                    value: null, child: Text(context.tr('photo.defaultTopic'))),
                ...state.topics.map(
                  (t) => DropdownMenuItem<int?>(value: t.id, child: Text(t.name)),
                ),
              ],
              onChanged: (id) => bloc.add(PhotoTopicSelected(id)),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _PhotoTile(
                    label: context.tr('photo.before'),
                    path: state.beforePath,
                    onTap: () => _pick(context, true),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _PhotoTile(
                    label: context.tr('photo.after'),
                    path: state.afterPath,
                    onTap: () => _pick(context, false),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextField(
              decoration: InputDecoration(
                labelText: context.tr('photo.note'),
              ),
              maxLines: 2,
              onChanged: (v) => bloc.add(PhotoNoteChanged(v)),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: (state.canSubmit && !submitting)
                  ? () => bloc.add(const PhotoSubmitted())
                  : null,
              icon: submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
              label: Text(submitting ? context.tr('photo.sending') : context.tr('photo.send')),
            ),
          ],
          ),
        );
      },
    );
  }
}

class _PhotoTile extends StatelessWidget {
  const _PhotoTile({required this.label, required this.path, required this.onTap});

  final String label;
  final String? path;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AspectRatio(
        aspectRatio: 3 / 4,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.grey.shade300),
            image: path != null
                ? DecorationImage(
                    image: FileImage(File(path!)), fit: BoxFit.cover)
                : null,
          ),
          child: path == null
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.add_a_photo_outlined, size: 32),
                    const SizedBox(height: 8),
                    Text(label,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ],
                )
              : Align(
                  alignment: Alignment.bottomLeft,
                  child: Container(
                    margin: const EdgeInsets.all(6),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(label,
                        style: const TextStyle(
                            color: Colors.white, fontSize: 12)),
                  ),
                ),
        ),
      ),
    );
  }
}
