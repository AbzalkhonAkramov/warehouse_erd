part of 'photo_report_bloc.dart';

sealed class PhotoReportEvent extends Equatable {
  const PhotoReportEvent();

  @override
  List<Object?> get props => [];
}

class PhotoInitRequested extends PhotoReportEvent {
  const PhotoInitRequested();
}

class PhotoCustomerSelected extends PhotoReportEvent {
  const PhotoCustomerSelected(this.id);
  final int id;
  @override
  List<Object?> get props => [id];
}

class PhotoTopicSelected extends PhotoReportEvent {
  const PhotoTopicSelected(this.id);
  final int? id;
  @override
  List<Object?> get props => [id];
}

class PhotoNoteChanged extends PhotoReportEvent {
  const PhotoNoteChanged(this.note);
  final String note;
  @override
  List<Object?> get props => [note];
}

class PhotoBeforePicked extends PhotoReportEvent {
  const PhotoBeforePicked(this.path);
  final String path;
  @override
  List<Object?> get props => [path];
}

class PhotoAfterPicked extends PhotoReportEvent {
  const PhotoAfterPicked(this.path);
  final String path;
  @override
  List<Object?> get props => [path];
}

class PhotoSubmitted extends PhotoReportEvent {
  const PhotoSubmitted();
}
