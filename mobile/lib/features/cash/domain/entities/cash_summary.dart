import 'package:equatable/equatable.dart';

class CashSummary extends Equatable {
  const CashSummary({
    required this.collected,
    required this.received,
    required this.pending,
    required this.outstanding,
    required this.available,
    required this.mode,
  });

  final double collected; // all payments the agent collected
  final double received; // handed over and confirmed by a manager
  final double pending; // declared, awaiting confirmation
  final double outstanding; // collected − received (still with agent)
  final double available; // collected − received − pending (free to hand over)
  final String mode; // manager_records | agent_submits

  bool get agentSubmits => mode == 'agent_submits';

  @override
  List<Object?> get props =>
      [collected, received, pending, outstanding, available, mode];
}
