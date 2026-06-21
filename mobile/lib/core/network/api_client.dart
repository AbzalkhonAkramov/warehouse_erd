import 'package:dio/dio.dart';

import '../config.dart';
import '../storage/token_storage.dart';
import 'api_exception.dart';

/// Thin wrapper over Dio: injects the bearer token and maps errors to
/// [ApiException]. All data sources go through this.
class ApiClient {
  ApiClient(this._tokenStorage)
      : _dio = Dio(
          BaseOptions(
            baseUrl: AppConfig.baseUrl,
            connectTimeout: const Duration(seconds: 15),
            receiveTimeout: const Duration(seconds: 30),
          ),
        ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.read();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final Dio _dio;
  final TokenStorage _tokenStorage;

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    return _wrap(() => _dio.get(path, queryParameters: query));
  }

  Future<dynamic> post(String path, {Object? data, bool form = false}) async {
    return _wrap(
      () => _dio.post(
        path,
        data: form ? data : data,
        options: form
            ? Options(contentType: Headers.formUrlEncodedContentType)
            : null,
      ),
    );
  }

  Future<dynamic> postMultipart(String path, FormData data) async {
    return _wrap(() => _dio.post(path, data: data));
  }

  Future<dynamic> _wrap(Future<Response<dynamic>> Function() call) async {
    try {
      final res = await call();
      return res.data;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  ApiException _mapError(DioException e) {
    final status = e.response?.statusCode;
    final data = e.response?.data;
    String message = 'Network error';
    if (data is Map && data['detail'] is String) {
      message = data['detail'] as String;
    } else if (data is Map && data['detail'] is List) {
      final list = data['detail'] as List;
      message = list.map((d) => d is Map ? d['msg'] : d).join(', ');
    } else if (e.type == DioExceptionType.connectionError) {
      message = 'Cannot reach the server';
    }
    return ApiException(message, statusCode: status);
  }
}
