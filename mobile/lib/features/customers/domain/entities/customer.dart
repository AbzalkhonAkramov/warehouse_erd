import 'package:equatable/equatable.dart';

class Customer extends Equatable {
  const Customer({
    required this.id,
    required this.name,
    this.phone,
    this.address,
    this.creditLimit = 0,
    this.debt = 0,
  });

  final int id;
  final String name;
  final String? phone;
  final String? address;
  final double creditLimit;
  final double debt;

  @override
  List<Object?> get props => [id, name, phone, address, creditLimit, debt];
}
