import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/di/injection.dart';
import '../../../../l10n/l10n_ext.dart';
import '../cubit/create_shop_cubit.dart';

class CreateShopPage extends StatelessWidget {
  const CreateShopPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<CreateShopCubit>()..loadRegions(),
      child: const _CreateShopView(),
    );
  }
}

class _CreateShopView extends StatefulWidget {
  const _CreateShopView();

  @override
  State<_CreateShopView> createState() => _CreateShopViewState();
}

class _CreateShopViewState extends State<_CreateShopView> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  int? _regionId;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    _city.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      context.read<CreateShopCubit>().submit(
            name: _name.text.trim(),
            phone: _phone.text.trim(),
            address: _address.text.trim(),
            city: _city.text.trim(),
            regionId: _regionId,
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('createShop.title'))),
      body: BlocConsumer<CreateShopCubit, CreateShopState>(
        listener: (context, state) {
          if (state.status == CreateShopStatus.success) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(context.tr('createShop.success')),
                backgroundColor: Colors.green,
              ),
            );
            Navigator.of(context).pop(true);
          } else if (state.status == CreateShopStatus.error && state.error != null) {
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text(state.error!)));
          }
        },
        builder: (context, state) {
          final submitting = state.status == CreateShopStatus.submitting;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _name,
                    decoration: InputDecoration(labelText: context.tr('field.name')),
                    validator: (v) => (v == null || v.trim().isEmpty) ? '—' : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(labelText: context.tr('field.phone')),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _city,
                    decoration: InputDecoration(labelText: context.tr('field.city')),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<int>(
                    initialValue: _regionId,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: context.tr('field.region')),
                    items: [
                      DropdownMenuItem(
                          value: null, child: Text(context.tr('field.noRegion'))),
                      ...state.regions.map((r) =>
                          DropdownMenuItem(value: r.id, child: Text(r.name))),
                    ],
                    onChanged: (v) => setState(() => _regionId = v),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _address,
                    decoration: InputDecoration(labelText: context.tr('field.address')),
                  ),
                  const SizedBox(height: 22),
                  FilledButton(
                    onPressed: submitting ? null : _submit,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: submitting
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : Text(context.tr('createShop.submit')),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
