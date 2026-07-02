import 'package:get_it/get_it.dart';

import '../branding.dart';
import '../network/api_client.dart';
import '../network/connectivity_service.dart';
import '../settings/settings_cubit.dart';
import '../storage/token_storage.dart';
import '../../l10n/locale_cubit.dart';
// Auth
import '../../features/auth/data/datasources/auth_remote_data_source.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
// Customers
import '../../features/customers/data/datasources/customer_remote_data_source.dart';
import '../../features/customers/data/repositories/customer_repository_impl.dart';
import '../../features/customers/domain/repositories/customer_repository.dart';
import '../../features/customers/presentation/cubit/customers_cubit.dart';
import '../../features/customers/presentation/cubit/create_shop_cubit.dart';
// Products
import '../../features/products/data/datasources/product_remote_data_source.dart';
import '../../features/products/data/repositories/product_repository_impl.dart';
import '../../features/products/domain/repositories/product_repository.dart';
// Orders
import '../../features/orders/data/datasources/order_local_data_source.dart';
import '../../features/orders/data/datasources/order_remote_data_source.dart';
import '../../features/orders/data/repositories/order_repository_impl.dart';
import '../../features/orders/domain/repositories/order_repository.dart';
import '../../features/orders/presentation/cubit/create_order_cubit.dart';
import '../../features/orders/presentation/cubit/orders_cubit.dart';
import '../../features/orders/presentation/cubit/outbox_cubit.dart';
// Photo reports
import '../../features/photo_report/data/datasources/photo_remote_data_source.dart';
import '../../features/photo_report/data/repositories/photo_repository_impl.dart';
import '../../features/photo_report/domain/repositories/photo_repository.dart';
import '../../features/photo_report/presentation/bloc/photo_report_bloc.dart';
// Finance (invoices & payments)
import '../../features/finance/data/datasources/finance_remote_data_source.dart';
import '../../features/finance/data/repositories/finance_repository_impl.dart';
import '../../features/finance/domain/repositories/finance_repository.dart';
import '../../features/finance/presentation/cubit/invoices_cubit.dart';
// Cash custody
import '../../features/cash/data/datasources/cash_remote_data_source.dart';
import '../../features/cash/data/repositories/cash_repository_impl.dart';
import '../../features/cash/domain/repositories/cash_repository.dart';
import '../../features/cash/presentation/cubit/cash_cubit.dart';

final GetIt sl = GetIt.instance;

void configureDependencies() {
  // Core
  sl.registerLazySingleton(() => TokenStorage());
  sl.registerLazySingleton(() => ApiClient(sl()));
  sl.registerLazySingleton(() => LocaleCubit());
  sl.registerLazySingleton(() => SettingsCubit());
  sl.registerLazySingleton(() => ConnectivityService());
  sl.registerLazySingleton(() => BrandingService(sl()));

  // Auth
  sl.registerLazySingleton(() => AuthRemoteDataSource(sl()));
  sl.registerLazySingleton<AuthRepository>(
      () => AuthRepositoryImpl(sl(), sl()));
  sl.registerLazySingleton(() => AuthBloc(sl()));

  // Customers
  sl.registerLazySingleton(() => CustomerRemoteDataSource(sl()));
  sl.registerLazySingleton<CustomerRepository>(
      () => CustomerRepositoryImpl(sl()));
  sl.registerFactory(() => CustomersCubit(sl()));
  sl.registerFactory(() => CreateShopCubit(sl()));

  // Products
  sl.registerLazySingleton(() => ProductRemoteDataSource(sl()));
  sl.registerLazySingleton<ProductRepository>(
      () => ProductRepositoryImpl(sl()));

  // Orders
  sl.registerLazySingleton(() => OrderRemoteDataSource(sl()));
  sl.registerLazySingleton(() => OrderLocalDataSource());
  sl.registerLazySingleton<OrderRepository>(
      () => OrderRepositoryImpl(sl(), sl()));
  sl.registerFactory(() => CreateOrderCubit(sl(), sl(), sl()));
  sl.registerFactory(() => OrdersCubit(sl(), sl()));
  sl.registerLazySingleton(() => OutboxCubit(sl(), sl()));

  // Photo reports
  sl.registerLazySingleton(() => PhotoRemoteDataSource(sl()));
  sl.registerLazySingleton<PhotoRepository>(() => PhotoRepositoryImpl(sl()));
  sl.registerFactory(() => PhotoReportBloc(sl(), sl(), sl()));

  // Finance (invoices & payments)
  sl.registerLazySingleton(() => FinanceRemoteDataSource(sl()));
  sl.registerLazySingleton<FinanceRepository>(() => FinanceRepositoryImpl(sl()));
  sl.registerFactory(() => InvoicesCubit(sl(), sl()));

  // Cash custody
  sl.registerLazySingleton(() => CashRemoteDataSource(sl()));
  sl.registerLazySingleton<CashRepository>(() => CashRepositoryImpl(sl()));
  sl.registerFactory(() => CashCubit(sl()));
}
