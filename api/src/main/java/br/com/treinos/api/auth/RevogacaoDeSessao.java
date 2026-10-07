package br.com.treinos.api.auth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/** Transação própria (como a Central): o 401 que vem logo depois do reuso não pode desfazer a revogação. */
@Service
public class RevogacaoDeSessao {

    private final RefreshTokenRepository repository;

    public RevogacaoDeSessao(RefreshTokenRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revogarTodos(UUID usuarioId) {
        repository.revogarTodos(usuarioId, Instant.now());
    }
}
