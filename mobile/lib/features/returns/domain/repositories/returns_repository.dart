abstract class ReturnsRepository {
  Future<void> submitReturn({
    required int salesOrderId,
    required List<({int productId, double quantity})> lines,
    String? note,
  });
}
