import 'package:dio/dio.dart';

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
    int? topicId,
    String? note,
    required String beforePath,
    required String afterPath,
  }) async {
    final form = FormData.fromMap({
      'customer_id': customerId,
      if (topicId != null) 'topic_id': topicId,
      if (note != null && note.isNotEmpty) 'note': note,
      'before': await MultipartFile.fromFile(beforePath, filename: 'before.jpg'),
      'after': await MultipartFile.fromFile(afterPath, filename: 'after.jpg'),
    });
    final data = await _client.postMultipart('/photo-reports', form);
    return PhotoSubmitResult(
      status: data['status'] as String,
      error: data['error'] as String?,
    );
  }
}
