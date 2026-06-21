import '../../../../core/network/api_client.dart';
import '../../domain/entities/agent.dart';

class AuthRemoteDataSource {
  AuthRemoteDataSource(this._client);

  final ApiClient _client;

  /// Returns the JWT access token. Backend expects an OAuth2 form body.
  Future<String> login(String email, String password) async {
    final data = await _client.post(
      '/auth/login',
      form: true,
      data: {'username': email, 'password': password},
    );
    return data['access_token'] as String;
  }

  Future<Agent> me() async {
    final json = await _client.get('/auth/me');
    return Agent(
      id: json['id'] as int,
      fullName: json['full_name'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      defaultTopicId: json['default_topic_id'] as int?,
    );
  }
}
