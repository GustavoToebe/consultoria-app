package br.com.treinos.api.auth;

import br.com.treinos.api.auditoria.Auditar;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Registro de quem abriu sessão. O {@code AuthService} não roda em transação (o módulo de autenticação não pode ser chamado
 * dentro de uma), e a auditoria exige a transação da ação: por isso o registro mora aqui, em transação curta, e acontece antes
 * de a sessão ser emitida (se a auditoria falhar, nenhum token sai).
 */
@Component
public class AberturaDeSessao {

    private final UsuarioRepository usuarios;

    public AberturaDeSessao(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    @Transactional
    @Auditar(acao = "LOGIN_SUCESSO", entidade = "USUARIO", resumo = "Entrou no aplicativo.")
    public Usuario entrou(UUID usuarioId) {
        Usuario usuario = usuarios.findById(usuarioId).orElseThrow(() -> new IllegalStateException("Usuário sumiu no login."));
        usuario.registrarLogin(Instant.now());
        return usuario;
    }

    @Transactional
    @Auditar(acao = "LOGIN_SUCESSO", entidade = "USUARIO", resumo = "Abriu uma sessão no aplicativo.")
    public Usuario abriu(Usuario criado) {
        // O recém-criado chega solto (veio de outra transação): relê pelo id para o último acesso ser gravado como no login.
        Usuario usuario = usuarios.findById(criado.getId()).orElseThrow(() -> new IllegalStateException("Usuário sumiu na abertura."));
        usuario.registrarLogin(Instant.now());
        return usuario;
    }
}
