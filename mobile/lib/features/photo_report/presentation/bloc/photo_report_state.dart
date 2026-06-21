part of 'photo_report_bloc.dart';

enum PhotoStatus { initial, loading, ready, submitting, success, error }

class PhotoReportState extends Equatable {
  const PhotoReportState({
    this.status = PhotoStatus.initial,
    this.customers = const [],
    this.topics = const [],
    this.customerId,
    this.topicId,
    this.note,
    this.beforePath,
    this.afterPath,
    this.result,
    this.error,
  });

  final PhotoStatus status;
  final List<Customer> customers;
  final List<TopicOption> topics;
  final int? customerId;
  final int? topicId;
  final String? note;
  final String? beforePath;
  final String? afterPath;
  final PhotoSubmitResult? result;
  final String? error;

  bool get canSubmit =>
      customerId != null && beforePath != null && afterPath != null;

  PhotoReportState copyWith({
    PhotoStatus? status,
    List<Customer>? customers,
    List<TopicOption>? topics,
    int? customerId,
    int? topicId,
    String? note,
    String? beforePath,
    String? afterPath,
    PhotoSubmitResult? result,
    String? error,
  }) {
    return PhotoReportState(
      status: status ?? this.status,
      customers: customers ?? this.customers,
      topics: topics ?? this.topics,
      customerId: customerId ?? this.customerId,
      topicId: topicId ?? this.topicId,
      note: note ?? this.note,
      beforePath: beforePath ?? this.beforePath,
      afterPath: afterPath ?? this.afterPath,
      result: result,
      error: error,
    );
  }

  @override
  List<Object?> get props => [
        status,
        customers,
        topics,
        customerId,
        topicId,
        note,
        beforePath,
        afterPath,
        result,
        error,
      ];
}
