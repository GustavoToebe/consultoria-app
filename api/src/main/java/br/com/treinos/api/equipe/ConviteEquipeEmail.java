package br.com.treinos.api.equipe;

import br.com.plataforma.comum.auth.EmailsDeAcesso;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.consultoria.RemetenteDaConsultoria;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Manda o link do convite de equipe por e-mail (envio do módulo de autenticação), depois de o convite estar gravado. O link
 * continua na resposta para quem convida copiar: falha ou e-mail desligado só vira {@code false}, nunca desfaz o convite. Nada
 * de endereço, código ou link no log.
 */
@Component
public class ConviteEquipeEmail {

    private static final Logger LOG = LoggerFactory.getLogger(ConviteEquipeEmail.class);

    private final ObjectProvider<EmailsDeAcesso> emails;
    private final ConsultoriaRepository consultorias;

    public ConviteEquipeEmail(ObjectProvider<EmailsDeAcesso> emails, ConsultoriaRepository consultorias) {
        this.emails = emails;
        this.consultorias = consultorias;
    }

    /** Convite do sistema (a Central cria a consultoria): sai com o nome da plataforma. */
    public boolean enviar(String email, String link) {
        return enviar(email, link, null);
    }

    /** Convite de equipe de uma consultoria: sai com o nome e o responder-para dela ({@link RemetenteDaConsultoria}). */
    public boolean enviar(String email, String link, UUID consultoriaId) {
        EmailsDeAcesso envio = emails.getIfAvailable();
        if (envio == null) {
            return false;
        }
        try {
            var r = consultoriaId == null ? null : consultorias.findById(consultoriaId).map(RemetenteDaConsultoria::de).orElse(null);
            if (r != null) {
                try {
                    envio.enviarConvite(email, link, r.nomeRemetente(), r.responderPara(), r.remetente());
                    return true;
                } catch (IllegalArgumentException semRemetente) {
                    // A biblioteca recusou o remetente (nunca devia: a Marca usa as mesmas regras): uma tentativa sem ele, sem laço.
                }
            }
            envio.enviarConvite(email, link);
            return true;
        } catch (RuntimeException falha) {
            LOG.warn("Convite de equipe criado, mas o e-mail não foi enviado ({}).", falha.getClass().getSimpleName());
            return false;
        }
    }
}
