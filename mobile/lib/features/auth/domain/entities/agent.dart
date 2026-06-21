import 'package:equatable/equatable.dart';

class Agent extends Equatable {
  const Agent({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    this.defaultTopicId,
  });

  final int id;
  final String fullName;
  final String email;
  final String role;
  final int? defaultTopicId;

  @override
  List<Object?> get props => [id, fullName, email, role, defaultTopicId];
}
