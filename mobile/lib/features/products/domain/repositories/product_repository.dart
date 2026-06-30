import '../entities/category.dart';
import '../entities/product.dart';

abstract class ProductRepository {
  Future<List<Product>> fetchProducts();
  Future<List<Category>> fetchCategories();
}
