import 'package:equatable/equatable.dart';

class TopicOption extends Equatable {
  const TopicOption({required this.id, required this.name});

  final int id;
  final String name;

  @override
  List<Object?> get props => [id, name];
}
