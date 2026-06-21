import '../../domain/entities/photo_submit_result.dart';
import '../../domain/entities/topic_option.dart';
import '../../domain/repositories/photo_repository.dart';
import '../datasources/photo_remote_data_source.dart';

class PhotoRepositoryImpl implements PhotoRepository {
  PhotoRepositoryImpl(this._remote);

  final PhotoRemoteDataSource _remote;

  @override
  Future<List<TopicOption>> fetchTopics() => _remote.fetchTopics();

  @override
  Future<PhotoSubmitResult> submit({
    required int customerId,
    int? topicId,
    String? note,
    required String beforePath,
    required String afterPath,
  }) {
    return _remote.submit(
      customerId: customerId,
      topicId: topicId,
      note: note,
      beforePath: beforePath,
      afterPath: afterPath,
    );
  }
}
