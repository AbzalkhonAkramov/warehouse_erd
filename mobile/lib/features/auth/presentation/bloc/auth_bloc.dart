import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/network/api_exception.dart';
import '../../domain/entities/agent.dart';
import '../../domain/repositories/auth_repository.dart';

part 'auth_event.dart';
part 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc(this._repository) : super(const AuthState.initial()) {
    on<AuthCheckRequested>(_onCheck);
    on<AuthLoginRequested>(_onLogin);
    on<AuthLogoutRequested>(_onLogout);
  }

  final AuthRepository _repository;

  Future<void> _onCheck(AuthCheckRequested event, Emitter<AuthState> emit) async {
    if (!await _repository.hasSession()) {
      emit(const AuthState.unauthenticated());
      return;
    }
    try {
      final agent = await _repository.currentAgent();
      emit(AuthState.authenticated(agent));
    } on ApiException {
      await _repository.logout();
      emit(const AuthState.unauthenticated());
    }
  }

  Future<void> _onLogin(AuthLoginRequested event, Emitter<AuthState> emit) async {
    emit(const AuthState.loading());
    try {
      final agent = await _repository.login(event.email, event.password);
      emit(AuthState.authenticated(agent));
    } on ApiException catch (e) {
      emit(AuthState.unauthenticated(error: e.message));
    }
  }

  Future<void> _onLogout(AuthLogoutRequested event, Emitter<AuthState> emit) async {
    await _repository.logout();
    emit(const AuthState.unauthenticated());
  }
}
