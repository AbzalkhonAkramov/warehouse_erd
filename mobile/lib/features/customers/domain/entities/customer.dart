import 'package:equatable/equatable.dart';

class Customer extends Equatable {
  const Customer({
    required this.id,
    required this.name,
    this.phone,
    this.address,
    this.city,
    this.regionName,
    this.creditLimit = 0,
    this.debt = 0,
    this.visitDays = const [],
  });

  final int id;
  final String name;
  final String? phone;
  final String? address;
  final String? city;
  final String? regionName;
  final double creditLimit;
  final double debt;

  /// Weekday codes the agent may visit, e.g. ['mon','wed','fri'].
  final List<String> visitDays;

  @override
  List<Object?> get props =>
      [id, name, phone, address, city, regionName, creditLimit, debt, visitDays];
}
