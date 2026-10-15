package br.com.treinos.api.auth;

import br.com.plataforma.comum.auth.RedefinicaoDeSenha;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.web.Emails;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

/**
 * "Esqueci a senha" de treinador e aluno (mesma tabela {@code usuario}). Token, prazo, limites, MFA e sessões são do
 * {@link RedefinicaoDeSenha} da plataforma; aqui ficam só a busca da conta pelo e-mail, a regra de senha do app e a gravação do
 * hash. Chamar fora de transação: o módulo abre a dele e encerra as sessões depois do commit.
 *
 * <p>A busca por e-mail roda numa thread solta do módulo (sem requisição nem tenant): conta sem senha (convite ainda não
 * aceito) ou inativa não recebe nada, igual a e-mail que não existe.
 */
@Service
public class RedefinicaoSenhaService {

    private final ObjectProvider<RedefinicaoDeSenha> redefinicao;
    private final UsuarioRepository usuarios;
    private final Auditoria auditoria;

    public RedefinicaoSenhaService(ObjectProvider<RedefinicaoDeSenha> redefinicao, UsuarioRepository usuarios, Auditoria auditoria) {
        this.redefinicao = redefinicao;
        this.usuarios = usuarios;
        this.auditoria = auditoria;
    }

    public void solicitar(String email, String ip) {
        modulo().solicitar(Emails.normalizar(email), ip, this::contaPorEmail);
    }

    public void redefinir(String token, String novaSenha, String codigoMfa, String ip) {
        modulo().redefinir(token, novaSenha, codigoMfa, ip, this::validarSenha, this::gravar);
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

    private void gravar(String sujeito, String novoHash) {
        Usuario usuario = usuarios.buscarParaAlterar(UUID.fromString(sujeito))
                .orElseThrow(() -> new IllegalStateException("Conta da redefinição não encontrada."));
        usuario.trocarSenha(novoHash);
        usuarios.saveAndFlush(usuario);
        auditoria.senhaRedefinida(usuario);
    }
}
