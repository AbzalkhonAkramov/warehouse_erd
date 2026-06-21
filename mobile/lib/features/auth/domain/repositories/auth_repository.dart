import '../entities/agent.dart';

abstract class AuthRepository {
  Future<Agent> login(String email, String password);
  Future<Agent> currentAgent();
  Future<bool> hasSession();
  Future<void> logout();
}
