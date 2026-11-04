package br.com.treinos.api.auth;

import br.com.plataforma.comum.auth.RedefinicaoDeSenha;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.push.PushService;
import br.com.treinos.api.web.Emails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

/**
 * "Esqueci a senha" de treinador e aluno (mesma tabela {@code usuario}). Token, prazo, limites, MFA e sessões são do
 * {@link RedefinicaoDeSenha} da plataforma; aqui ficam só a busca da conta pelo e-mail, a regra de senha do app e a gravação do
 * hash. Chamar fora de transação: o módulo abre a dele e encerra as sessões depois do commit.
 *
 * <p>A busca por e-mail roda numa thread solta do módulo (sem requisição nem tenant): conta sem senha (convite ainda não
 * aceito) ou inativa não recebe nada, igual a e-mail que não existe.
 *
 * <p>Redefinir também apaga os tokens de push do usuário, como as outras trocas de senha: o aparelho precisa ligar o aviso de
 * novo. Isso roda só depois de o módulo gravar a senha e encerrar as sessões, e uma falha ao apagar só fica no log (pela
 * classe do erro): nunca desfaz a redefinição nem impede o encerramento das sessões.
 */
@Service
public class RedefinicaoSenhaService {

    private static final Logger LOG = LoggerFactory.getLogger(RedefinicaoSenhaService.class);

    /** Quem teve a senha gravada nesta redefinição (só os ids), para apagar os tokens de push depois. */
    private record Redefinido(UUID consultoriaId, UUID usuarioId) { }

    private final ObjectProvider<RedefinicaoDeSenha> redefinicao;
    private final UsuarioRepository usuarios;
    private final Auditoria auditoria;
    private final PushService push;

    public RedefinicaoSenhaService(ObjectProvider<RedefinicaoDeSenha> redefinicao, UsuarioRepository usuarios, Auditoria auditoria,
                                   PushService push) {
        this.redefinicao = redefinicao;
        this.usuarios = usuarios;
        this.auditoria = auditoria;
        this.push = push;
    }

    public void solicitar(String email, String ip) {
        modulo().solicitar(Emails.normalizar(email), ip, this::contaPorEmail);
    }

    public void redefinir(String token, String novaSenha, String codigoMfa, String ip) {
        AtomicReference<Redefinido> redefinido = new AtomicReference<>();
        modulo().redefinir(token, novaSenha, codigoMfa, ip, this::validarSenha,
                (sujeito, novoHash) -> redefinido.set(gravar(sujeito, novoHash)));
        // Aqui a senha nova já foi gravada (commit) e as sessões já caíram: só então os tokens de push saem.
        Redefinido quem = redefinido.get();
        if (quem != null) {
            try {
                push.apagarDoUsuario(quem.consultoriaId(), quem.usuarioId());
            } catch (RuntimeException e) {
                LOG.warn("Tokens de push não apagados na redefinição de senha ({}).", e.getClass().getSimpleName());
            }
        }
    }

    private RedefinicaoDeSenha modulo() {
        RedefinicaoDeSenha modulo = redefinicao.getIfAvailable();
        if (modulo == null) {
            throw new RedefinicaoIndisponivelException();
        }
        return modulo;
    }

    private Optional<RedefinicaoDeSenha.Conta> contaPorEmail(String email) {
        return usuarios.buscarPorEmail(email)
                .filter(u -> u.isAtivo() && u.getSenhaHash() != null)
                .map(u -> new RedefinicaoDeSenha.Conta(u.getId().toString(), u.getEmail()));
    }

    private void validarSenha(String sujeito, String novaSenha) {
        String email = usuarios.findById(UUID.fromString(sujeito)).map(Usuario::getEmail).orElse("");
        RegrasSenha.validar(novaSenha, email);
    }

    private Redefinido gravar(String sujeito, String novoHash) {
        Usuario usuario = usuarios.buscarParaAlterar(UUID.fromString(sujeito))
                .orElseThrow(() -> new IllegalStateException("Conta da redefinição não encontrada."));
        usuario.trocarSenha(novoHash);
        usuarios.saveAndFlush(usuario);
        auditoria.senhaRedefinida(usuario);
        return new Redefinido(usuario.getConsultoriaId(), usuario.getId());
    }
}
