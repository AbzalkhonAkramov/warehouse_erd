part of 'photo_report_bloc.dart';

enum PhotoStatus { initial, loading, ready, submitting, success, error }

class PhotoReportState extends Equatable {
  const PhotoReportState({
    this.status = PhotoStatus.initial,
    this.customers = const [],
    this.topics = const [],
    this.orders = const [],
    this.customerId,
    this.salesOrderId,
    this.topicId,
    this.note,
    this.beforePath,
    this.afterPath,
    this.locked = false,
    this.result,
    this.error,
  });

  final PhotoStatus status;
  final List<Customer> customers;
  final List<TopicOption> topics;
  final List<Order> orders;
  final int? customerId;
  final int? salesOrderId;
  final int? topicId;
  final String? note;
  final String? beforePath;
  final String? afterPath;
  // Customer + order pinned from a specific order; can't be changed on screen.
  final bool locked;
  final PhotoSubmitResult? result;
  final String? error;

  bool get canSubmit =>
      customerId != null && beforePath != null && afterPath != null;

  /// The current customer's orders eligible for a photo report — only SHIPPED
  /// orders qualify (photos can't be sent once an order is delivered).
  List<Order> get ordersForCustomer => customerId == null
      ? const []
      : orders
          .where((o) => o.customerId == customerId && o.status == 'shipped')
          .toList();

  PhotoReportState copyWith({
    PhotoStatus? status,
    List<Customer>? customers,
    List<TopicOption>? topics,
    List<Order>? orders,
    int? customerId,
    int? salesOrderId,
    bool clearOrder = false,
    int? topicId,
    String? note,
    String? beforePath,
    String? afterPath,
    bool? locked,
    PhotoSubmitResult? result,
    String? error,
  }) {
    return PhotoReportState(
      status: status ?? this.status,
      customers: customers ?? this.customers,
      topics: topics ?? this.topics,
      orders: orders ?? this.orders,
      customerId: customerId ?? this.customerId,
      salesOrderId: clearOrder ? null : (salesOrderId ?? this.salesOrderId),
      topicId: topicId ?? this.topicId,
      note: note ?? this.note,
      beforePath: beforePath ?? this.beforePath,
      afterPath: afterPath ?? this.afterPath,
      locked: locked ?? this.locked,
      result: result,
      error: error,
    );
  }

  @override
  List<Object?> get props => [
        status,
        customers,
        topics,
        orders,
        customerId,
        salesOrderId,
        topicId,
        note,
        beforePath,
        afterPath,
        locked,
        result,
        error,
      ];
}
