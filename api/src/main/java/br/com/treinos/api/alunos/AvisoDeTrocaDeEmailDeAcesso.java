package br.com.treinos.api.alunos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.consultoria.RemetenteDaConsultoria;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.UUID;

/**
 * Avisa o endereço ANTERIOR e o NOVO quando o treinador troca o e-mail de login do aluno. Os textos são fixos e levam só o nome
 * da consultoria: nunca e-mail nem nome do aluno em texto de log. O envio sai depois do commit (a troca já está gravada) e a
 * falha do provedor, ou o e-mail desligado, não desfaz nada. Chamado dentro da transação da troca: a consultoria é lida ali e
 * o envio roda no {@code afterCommit}, sem tocar no banco.
 */
@Component
public class AvisoDeTrocaDeEmailDeAcesso {

    private static final Logger LOG = LoggerFactory.getLogger(AvisoDeTrocaDeEmailDeAcesso.class);

    private final ObjectProvider<EnviadorDeEmail> emails;
    private final ConsultoriaRepository consultorias;

    public AvisoDeTrocaDeEmailDeAcesso(ObjectProvider<EnviadorDeEmail> emails, ConsultoriaRepository consultorias) {
        this.emails = emails;
        this.consultorias = consultorias;
    }

    /** Agenda os dois avisos para depois do commit da transação em curso; sem o envio ligado não faz nada. */
    public void agendar(UUID consultoriaId, String anterior, String novo) {
        EnviadorDeEmail envio = emails.getIfAvailable();
        if (envio == null || !TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        Consultoria consultoria = consultorias.findById(consultoriaId).orElse(null);
        String nome = consultoria == null ? null : consultoria.getNome();
        var remetente = consultoria == null ? null : RemetenteDaConsultoria.de(consultoria);
        List<EnviadorDeEmail.Mensagem> mensagens = List.of(
                mensagem(anterior, nome, remetente, "O e-mail de acesso à sua conta no app", "foi trocado pela sua equipe. A partir de agora o acesso é por outro endereço de e-mail.",
                        "Se você não esperava essa mudança, fale com a sua equipe."),
                mensagem(novo, nome, remetente, "Este endereço de e-mail passou a ser o de acesso à sua conta no app", "por decisão da sua equipe.",
                        "Use-o para entrar no app. Sua senha não mudou."));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                for (var m : mensagens) {
                    try {
                        envio.enviar(m);
                    } catch (RuntimeException falha) {
                        LOG.warn("E-mail de acesso trocado, mas o aviso não foi enviado ({}).", falha.getClass().getSimpleName());
                    }
                }
            }
        });
    }

    private static EnviadorDeEmail.Mensagem mensagem(String para, String consultoria, RemetenteDaConsultoria.Remetente r,
                                                     String inicio, String meio, String fim) {
        String de = consultoria == null || consultoria.isBlank() ? "" : " da " + umaLinha(consultoria);
        String texto = inicio + de + " " + meio + "\n\n" + fim;
        String assunto = "E-mail de acesso alterado" + (de.isEmpty() ? "" : " - " + umaLinha(consultoria));
        String html = "<!doctype html><html><body style=\"font-family:sans-serif\"><p>" + escapar(inicio + de + " " + meio) + "</p><p>"
                + escapar(fim) + "</p></body></html>";
        try {
            return new EnviadorDeEmail.Mensagem(para, assunto, texto, html, r == null ? null : r.nomeRemetente(),
                    r == null ? null : r.responderPara(), r == null ? null : r.remetente());
        } catch (IllegalArgumentException semRemetente) {
            return new EnviadorDeEmail.Mensagem(para, assunto, texto, html);
        }
    }

    private static String umaLinha(String texto) {
        return texto.replaceAll("[\\r\\n]+", " ").strip();
    }

    private static String escapar(String texto) {
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
