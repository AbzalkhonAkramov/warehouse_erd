import '../entities/photo_submit_result.dart';
import '../entities/topic_option.dart';

abstract class PhotoRepository {
  Future<List<TopicOption>> fetchTopics();

  Future<PhotoSubmitResult> submit({
    required int customerId,
    int? topicId,
    String? note,
    required String beforePath,
    required String afterPath,
  });
}
