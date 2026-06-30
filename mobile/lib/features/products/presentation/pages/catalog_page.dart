import 'package:flutter/material.dart';

import '../../../../core/config.dart';
import '../../../../core/di/injection.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../domain/entities/category.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/product_repository.dart';

class CatalogPage extends StatefulWidget {
  const CatalogPage({super.key});

  @override
  State<CatalogPage> createState() => _CatalogPageState();
}

class _CatalogPageState extends State<CatalogPage> {
  List<Product> _products = [];
  List<Category> _categories = [];
  bool _loading = true;
  String? _error;
  String _q = '';
  int? _cat;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = sl<ProductRepository>();
      final products = await repo.fetchProducts();
      final categories = await repo.fetchCategories();
      if (!mounted) return;
      setState(() {
        _products = products;
        _categories = categories;
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

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Text(_error!));

    final q = _q.trim().toLowerCase();
    final list = _products.where((p) {
      final matchName = q.isEmpty ||
          p.name.toLowerCase().contains(q) ||
          p.sku.toLowerCase().contains(q);
      final matchCat = _cat == null || p.categoryId == _cat;
      return matchName && matchCat;
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          child: TextField(
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: context.tr('catalog.search'),
              isDense: true,
              border: const OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _q = v),
          ),
        ),
        if (_categories.isNotEmpty)
          SizedBox(
            height: 42,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(context.tr('order.allCategories')),
                    selected: _cat == null,
                    onSelected: (_) => setState(() => _cat = null),
                  ),
                ),
                ..._categories.map((c) => Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(c.name),
                        selected: _cat == c.id,
                        onSelected: (_) => setState(() => _cat = c.id),
                      ),
                    )),
              ],
            ),
          ),
        const Divider(height: 1),
        Expanded(
          child: list.isEmpty
              ? Center(child: Text(context.tr('catalog.empty')))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, i) {
                      final p = list[i];
                      return ListTile(
                        leading: _Thumb(product: p),
                        title: Text(p.name),
                        subtitle: Text('${context.tr('product.stock')}: '
                            '${p.onHand.toStringAsFixed(0)} ${p.unit}'),
                        trailing: Text(
                          p.salePrice.toStringAsFixed(2),
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    const size = 48.0;
    final placeholder = Container(
      width: size,
      height: size,
      color: Colors.grey.shade200,
      child: const Icon(Icons.inventory_2_outlined, color: Colors.grey),
    );
    if (product.imagePath == null) return placeholder;
    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: Image.network(
        AppConfig.uploadUrl(product.imagePath!),
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => placeholder,
      ),
    );
  }
}
