import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:image_picker/image_picker.dart' show XFile;

import '../../../../core/network/api_client.dart';
import '../../domain/entities/photo_submit_result.dart';
import '../../domain/entities/topic_option.dart';

class PhotoRemoteDataSource {
  PhotoRemoteDataSource(this._client);

  final ApiClient _client;

  Future<List<TopicOption>> fetchTopics() async {
    final data = await _client.get('/photo-reports/topics') as List<dynamic>;
    return data
        .map((j) => TopicOption(id: j['id'] as int, name: j['name'] as String))
        .toList();
  }

  Future<PhotoSubmitResult> submit({
    required int customerId,
    int? salesOrderId,
    int? topicId,
    String? note,
    required String beforePath,
    required String afterPath,
  }) async {
    final form = FormData.fromMap({
      'customer_id': customerId,
      if (salesOrderId != null) 'sales_order_id': salesOrderId,
      if (topicId != null) 'topic_id': topicId,
      if (note != null && note.isNotEmpty) 'note': note,
      'before': await _part(beforePath, 'before.jpg'),
      'after': await _part(afterPath, 'after.jpg'),
    });
    final data = await _client.postMultipart('/photo-reports', form);
    return PhotoSubmitResult(
      status: data['status'] as String,
      error: data['error'] as String?,
    );
  }

  /// Builds a multipart part cross-platform: on web the picked path is a blob
  /// URL with no filesystem access, so read the bytes via [XFile]; on mobile
  /// stream straight from the file path.
  Future<MultipartFile> _part(String path, String filename) async {
    if (kIsWeb) {
      final bytes = await XFile(path).readAsBytes();
      return MultipartFile.fromBytes(bytes, filename: filename);
    }
    return MultipartFile.fromFile(path, filename: filename);
  }
}
