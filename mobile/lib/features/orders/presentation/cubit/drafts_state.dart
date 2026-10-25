part of 'drafts_cubit.dart';

class DraftsState extends Equatable {
  const DraftsState({
    this.loading = true,
    this.drafts = const [],
    this.customerNames = const {},
  });

  final bool loading;
  final List<OrderDraft> drafts;
  final Map<int, String> customerNames;

  DraftsState copyWith({
    bool? loading,
    List<OrderDraft>? drafts,
    Map<int, String>? customerNames,
  }) {
    return DraftsState(
      loading: loading ?? this.loading,
      drafts: drafts ?? this.drafts,
      customerNames: customerNames ?? this.customerNames,
    );
  }

  @override
  List<Object?> get props => [loading, drafts, customerNames];
}
