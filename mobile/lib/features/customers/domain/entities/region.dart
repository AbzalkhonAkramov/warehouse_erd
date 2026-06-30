import 'package:equatable/equatable.dart';

class Region extends Equatable {
  const Region({required this.id, required this.name});

  final int id;
  final String name;

  @override
  List<Object?> get props => [id, name];
}
