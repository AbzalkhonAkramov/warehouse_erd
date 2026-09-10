import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/config.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/format.dart';
import '../../../../core/settings/settings_cubit.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/state_views.dart';
import '../../../../l10n/l10n_ext.dart';
import '../../domain/entities/category.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/product_repository.dart';
import 'product_detail_page.dart';

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
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
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
    if (_loading) return const LoadingView();
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    // Only offer categories the agent actually has products in.
    final usedCategoryIds =
        _products.map((p) => p.categoryId).whereType<int>().toSet();
    final categories =
        _categories.where((c) => usedCategoryIds.contains(c.id)).toList();

    final showStock =
        context.watch<SettingsCubit>().state.showCatalogStock;

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
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            style: const TextStyle(
                color: Color(0xFF0F172A), fontWeight: FontWeight.w500),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search, color: AppColors.neutral),
              hintText: context.tr('catalog.search'),
              suffixIcon: _q.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.close, color: AppColors.neutral),
                      onPressed: () {
                        _search.clear();
                        setState(() => _q = '');
                      },
                    ),
            ),
            onChanged: (v) => setState(() => _q = v),
          ),
        ),
        if (categories.isNotEmpty)
          SizedBox(
            height: 50,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                _CategoryChip(
                  label: context.tr('order.allCategories'),
                  selected: _cat == null,
                  onTap: () => setState(() => _cat = null),
                ),
                ...categories.map((c) => _CategoryChip(
                      label: c.name,
                      selected: _cat == c.id,
                      onTap: () => setState(() => _cat = c.id),
                    )),
              ],
            ),
          ),
        Expanded(
          child: list.isEmpty
              ? RefreshableEmpty(
                  onRefresh: _load,
                  message: context.tr('catalog.empty'),
                  icon: Icons.inventory_2_outlined,
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: GridView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      mainAxisExtent: showStock ? 252 : 232,
                    ),
                    itemCount: list.length,
                    itemBuilder: (context, i) =>
                        _ProductCard(product: list[i], showStock: showStock),
                  ),
                ),
        ),
      ],
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.showStock});

  final Product product;
  final bool showStock;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) =>
              ProductDetailPage(product: product, showStock: showStock),
        )),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(height: 138, child: _Photo(product: product)),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13.5, height: 1.2),
                  ),
                  const Spacer(),
                  Text(
                    product.currencySymbol != null
                        ? '${money(product.salePrice)} ${product.currencySymbol}'
                        : money(product.salePrice),
                    style: const TextStyle(
                        color: AppColors.brand,
                        fontWeight: FontWeight.bold,
                        fontSize: 15),
                  ),
                  if (showStock)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Row(
                        children: [
                          const Icon(Icons.inventory_2_outlined,
                              size: 13, color: AppColors.neutral),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              '${qty(product.onHand)} ${product.unit}',
                              style: const TextStyle(
                                  color: AppColors.neutral, fontSize: 12),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
      ),
    );
  }
}

/// Modern, high-contrast category filter pill: solid brand when selected,
/// white with a hairline border and readable dark text when not.
class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Center(
        child: Material(
          color: selected ? AppColors.brand : Colors.white,
          shape: StadiumBorder(
            side: BorderSide(
              color: selected ? AppColors.brand : AppColors.line,
            ),
          ),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : const Color(0xFF0F172A),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The product photo shown in full (uncropped) on a soft background.
class _Photo extends StatelessWidget {
  const _Photo({required this.product});

  final Product product;

  @override
  Widget build(BuildContext context) {
    const placeholder = ColoredBox(
      color: Color(0xFFF1F5F9),
      child: Center(
        child: Icon(Icons.inventory_2_outlined,
            color: AppColors.line, size: 40),
      ),
    );
    if (product.imagePath == null) return placeholder;
    return ColoredBox(
      color: const Color(0xFFF8FAFC),
      child: Image.network(
        AppConfig.uploadUrl(product.imagePath!),
        fit: BoxFit.contain,
        width: double.infinity,
        errorBuilder: (_, __, ___) => placeholder,
        loadingBuilder: (context, child, progress) => progress == null
            ? child
            : const Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
      ),
    );
  }
}
