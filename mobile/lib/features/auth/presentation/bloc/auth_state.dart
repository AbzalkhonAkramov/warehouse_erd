part of 'auth_bloc.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated }

class AuthState extends Equatable {
  const AuthState._(this.status, {this.agent, this.error});

  const AuthState.initial() : this._(AuthStatus.initial);
  const AuthState.loading() : this._(AuthStatus.loading);
  const AuthState.authenticated(Agent agent)
      : this._(AuthStatus.authenticated, agent: agent);
  const AuthState.unauthenticated({String? error})
      : this._(AuthStatus.unauthenticated, error: error);

  final AuthStatus status;
  final Agent? agent;
  final String? error;

  @override
  List<Object?> get props => [status, agent, error];
}
