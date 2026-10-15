package br.com.treinos.api.equipe;

import br.com.plataforma.comum.auth.EmailsDeAcesso;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/**
 * Manda o link do convite de equipe por e-mail (envio do módulo de autenticação), depois de o convite estar gravado. O link
 * continua na resposta para quem convida copiar: falha ou e-mail desligado só vira {@code false}, nunca desfaz o convite. Nada
 * de endereço, código ou link no log.
 */
@Component
public class ConviteEquipeEmail {

    private static final Logger LOG = LoggerFactory.getLogger(ConviteEquipeEmail.class);

    private final ObjectProvider<EmailsDeAcesso> emails;

    public ConviteEquipeEmail(ObjectProvider<EmailsDeAcesso> emails) {
        this.emails = emails;
    }

    public boolean enviar(String email, String link) {
        EmailsDeAcesso envio = emails.getIfAvailable();
        if (envio == null) {
            return false;
        }
        try {
            envio.enviarConvite(email, link);
            return true;
        } catch (RuntimeException falha) {
            LOG.warn("Convite de equipe criado, mas o e-mail não foi enviado ({}).", falha.getClass().getSimpleName());
            return false;
        }
    }
}
