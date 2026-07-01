import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// User preferences that only affect presentation (persisted across launches).
class SettingsState extends Equatable {
  const SettingsState({this.showCatalogStock = true});

  /// Whether the stock (pcs) is shown on catalog product cards.
  final bool showCatalogStock;

  SettingsState copyWith({bool? showCatalogStock}) =>
      SettingsState(showCatalogStock: showCatalogStock ?? this.showCatalogStock);

  @override
  List<Object?> get props => [showCatalogStock];
}

class SettingsCubit extends Cubit<SettingsState> {
  SettingsCubit() : super(const SettingsState());

  static const _kCatalogStock = 'show_catalog_stock';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    emit(SettingsState(
      showCatalogStock: prefs.getBool(_kCatalogStock) ?? true,
    ));
  }

  Future<void> setShowCatalogStock(bool value) async {
    emit(state.copyWith(showCatalogStock: value));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kCatalogStock, value);
  }
}
