import '../../../../core/storage/token_storage.dart';
import '../../domain/entities/agent.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._remote, this._tokenStorage);

  final AuthRemoteDataSource _remote;
  final TokenStorage _tokenStorage;

  @override
  Future<Agent> login(String email, String password) async {
    final token = await _remote.login(email, password);
    await _tokenStorage.save(token);
    return _remote.me();
  }

  @override
  Future<Agent> currentAgent() => _remote.me();

  @override
  Future<bool> hasSession() async => (await _tokenStorage.read()) != null;

  @override
  Future<void> logout() => _tokenStorage.clear();
}
