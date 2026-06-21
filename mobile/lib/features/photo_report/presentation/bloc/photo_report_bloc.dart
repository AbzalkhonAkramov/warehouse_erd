import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../../customers/domain/entities/customer.dart';
import '../../../customers/domain/repositories/customer_repository.dart';
import '../../domain/entities/photo_submit_result.dart';
import '../../domain/entities/topic_option.dart';
import '../../domain/repositories/photo_repository.dart';

part 'photo_report_event.dart';
part 'photo_report_state.dart';

class PhotoReportBloc extends Bloc<PhotoReportEvent, PhotoReportState> {
  PhotoReportBloc(this._photos, this._customers)
      : super(const PhotoReportState()) {
    on<PhotoInitRequested>(_onInit);
    on<PhotoCustomerSelected>((e, emit) => emit(state.copyWith(customerId: e.id)));
    on<PhotoTopicSelected>((e, emit) => emit(state.copyWith(topicId: e.id)));
    on<PhotoNoteChanged>((e, emit) => emit(state.copyWith(note: e.note)));
    on<PhotoBeforePicked>((e, emit) => emit(state.copyWith(beforePath: e.path)));
    on<PhotoAfterPicked>((e, emit) => emit(state.copyWith(afterPath: e.path)));
    on<PhotoSubmitted>(_onSubmit);
  }

  final PhotoRepository _photos;
  final CustomerRepository _customers;

  Future<void> _onInit(
      PhotoInitRequested event, Emitter<PhotoReportState> emit) async {
    emit(state.copyWith(status: PhotoStatus.loading));
    try {
      final customers = await _customers.fetchCustomers();
      final topics = await _photos.fetchTopics();
      emit(state.copyWith(
        status: PhotoStatus.ready,
        customers: customers,
        topics: topics,
      ));
    } on ApiException catch (e) {
      emit(state.copyWith(status: PhotoStatus.error, error: e.message));
    }
  }

  Future<void> _onSubmit(
      PhotoSubmitted event, Emitter<PhotoReportState> emit) async {
    if (!state.canSubmit) return;
    emit(state.copyWith(status: PhotoStatus.submitting));
    try {
      final result = await _photos.submit(
        customerId: state.customerId!,
        topicId: state.topicId,
        note: state.note,
        beforePath: state.beforePath!,
        afterPath: state.afterPath!,
      );
      emit(state.copyWith(status: PhotoStatus.success, result: result));
    } on ApiException catch (e) {
      emit(state.copyWith(status: PhotoStatus.error, error: e.message));
    }
  }
}
