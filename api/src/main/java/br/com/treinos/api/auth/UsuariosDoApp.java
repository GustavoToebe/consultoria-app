package br.com.treinos.api.auth;

import br.com.plataforma.comum.auth.UsuariosDaAutenticacao;
import br.com.treinos.api.web.Emails;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Entrega ao módulo de autenticação da plataforma o que ele precisa do usuário: achar pelo e-mail e dizer se ainda existe, está
 * ativo e em que versão de credenciais está ({@code credenciais_versao}, que sobe ao trocar a senha, o perfil ou o MFA e ao
 * desativar). O sujeito dos tokens é o id do usuário.
 */
@Component
public class UsuariosDoApp implements UsuariosDaAutenticacao {

    private final UsuarioRepository usuarios;

    public UsuariosDoApp(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    @Override
    public Optional<Credencial> buscarPorLogin(String login) {
        return usuarios.buscarPorEmail(Emails.normalizar(login)).map(u ->
                new Credencial(u.getId().toString(), u.getSenhaHash(), u.isAtivo(), u.getCredenciaisVersao()));
    }

    @Override
    public Optional<Long> versaoDeCredenciais(String sujeito) {
        try {
            return usuarios.findById(UUID.fromString(sujeito)).filter(Usuario::isAtivo).map(Usuario::getCredenciaisVersao);
        } catch (IllegalArgumentException sujeitoQueNaoEUuid) {
            return Optional.empty();
        }
    }
}
