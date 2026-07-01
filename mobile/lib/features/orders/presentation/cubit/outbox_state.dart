part of 'outbox_cubit.dart';

class OutboxState extends Equatable {
  const OutboxState({
    this.online = true,
    this.pending = 0,
    this.syncing = false,
    this.syncedTick = 0,
    this.justSynced = 0,
  });

  /// Whether the device currently has connectivity.
  final bool online;

  /// Number of orders waiting in the offline outbox.
  final int pending;

  /// True while a drain is in progress.
  final bool syncing;

  /// Increments each time ≥1 order is successfully sent — a signal for the
  /// orders list to reload.
  final int syncedTick;

  /// How many orders were sent in the last drain (for a toast).
  final int justSynced;

  OutboxState copyWith({
    bool? online,
    int? pending,
    bool? syncing,
    int? syncedTick,
    int? justSynced,
  }) {
    return OutboxState(
      online: online ?? this.online,
      pending: pending ?? this.pending,
      syncing: syncing ?? this.syncing,
      syncedTick: syncedTick ?? this.syncedTick,
      justSynced: justSynced ?? this.justSynced,
    );
  }

  @override
  List<Object?> get props => [online, pending, syncing, syncedTick, justSynced];
}
