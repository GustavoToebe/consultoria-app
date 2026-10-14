package br.com.treinos.api.auth;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.web.Emails;

import java.nio.charset.StandardCharsets;

/** Senha: mínimo 8 caracteres, máximo 72 bytes (o BCrypt ignora o resto) e diferente do e-mail. */
public final class RegrasSenha {

    private RegrasSenha() {
    }

    public static void validar(String senha, String email) {
        if (senha == null || senha.length() < 8) {
            throw new BadRequestException("A senha precisa ter pelo menos 8 caracteres.");
        }
        if (senha.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadRequestException("A senha pode ter no máximo 72 bytes (cerca de 72 letras sem acento).");
        }
        if (Emails.normalizar(senha).equals(Emails.normalizar(email))) {
            throw new BadRequestException("A senha não pode ser igual ao e-mail.");
        }
    }
}
