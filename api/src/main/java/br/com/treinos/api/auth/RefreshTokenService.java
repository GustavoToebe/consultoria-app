package br.com.treinos.api.auth;

import br.com.treinos.api.security.DestinoCliente;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.security.SecurityProperties;
import br.com.treinos.api.web.NaoAutorizadoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private final RefreshTokenRepository repository;
    private final UsuarioRepository usuarios;
    private final SecurityProperties properties;
    private final RevogacaoDeSessao revogacao;

    public RefreshTokenService(RefreshTokenRepository repository, UsuarioRepository usuarios,
                               SecurityProperties properties, RevogacaoDeSessao revogacao) {
        this.repository = repository;
        this.usuarios = usuarios;
        this.properties = properties;
        this.revogacao = revogacao;
    }

    @Transactional
    public String emitir(Usuario usuario, DestinoCliente cliente) {
        String bruto = OpaqueTokenGenerator.gerar();
        repository.save(new RefreshToken(usuario.getId(), OpaqueTokenGenerator.hash(bruto), cliente,
                Instant.now().plus(properties.refreshTokenTtl())));
        return bruto;
    }

    /**
     * Troca o refresh por um novo. O usuário é travado antes de reler o token: dois refresh simultâneos do mesmo token
     * ficam em série, e o segundo vê o token já usado. Token usado ou revogado apresentado de novo derruba todas as
     * sessões (detecção de roubo).
     */
    @Transactional
    public Rotacao rotacionar(String tokenBruto) {
        String hash = OpaqueTokenGenerator.hash(tokenBruto);
        UUID usuarioId = repository.usuarioDoToken(hash).orElseThrow(RefreshTokenService::sessaoInvalida);
        Usuario usuario = usuarios.buscarParaAlterar(usuarioId)
                .filter(Usuario::isAtivo)
                .orElseThrow(RefreshTokenService::sessaoInvalida);
        RefreshToken atual = repository.findByTokenHash(hash).orElseThrow(RefreshTokenService::sessaoInvalida);
        Instant agora = Instant.now();
        if (atual.isGasto()) {
            revogacao.revogarTodos(usuarioId);
            throw sessaoInvalida();
        }
        if (atual.isExpirado(agora)) {
            throw sessaoInvalida();
        }
        atual.marcarUsado(agora);
        return new Rotacao(usuario, emitir(usuario, atual.getCliente()));
    }

    @Transactional
    public void revogar(String tokenBruto) {
        repository.findByTokenHash(OpaqueTokenGenerator.hash(tokenBruto)).ifPresent(token -> {
            if (!token.isGasto()) {
                token.revogar(Instant.now());
            }
        });
    }

    /** Troca de senha e desativação: encerra todas as sessões na mesma transação. */
    @Transactional
    public void encerrarTodas(UUID usuarioId) {
        repository.apagarTodos(usuarioId);
    }

    private static NaoAutorizadoException sessaoInvalida() {
        return new NaoAutorizadoException("Sessão inválida ou expirada. Entre de novo.", "SESSAO_EXPIRADA");
    }

    public record Rotacao(Usuario usuario, String refreshTokenBruto) {
    }
}
