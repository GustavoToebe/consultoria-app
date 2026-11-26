package br.com.treinos.api.alunos;

import br.com.plataforma.comum.auth.EnviadorDeEmail;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.consultoria.RemetenteDaConsultoria;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Avisa o endereço ANTERIOR e o NOVO quando o treinador troca o e-mail de login do aluno. Os textos são fixos e levam só o nome
 * da consultoria: nunca e-mail nem nome do aluno em texto de log. O envio sai depois do commit (a troca já está gravada) e a
 * falha do provedor, ou o e-mail desligado, não desfaz nada. {@link #preparar} roda dentro da transação da troca (lê a
 * consultoria) e {@link #enviar}, depois dela, devolve se o aviso ao e-mail novo foi entregue ao provedor.
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

    /** Os dois avisos prontos, para sair depois do commit; o envio só acontece em {@link #enviar}. */
    public record Preparado(EnviadorDeEmail envio, EnviadorDeEmail.Mensagem anterior, EnviadorDeEmail.Mensagem novo) {
        @Override
        public String toString() {
            return "Preparado[***]"; // as mensagens levam os endereços
        }
    }

    /** Monta os dois avisos dentro da transação da troca (lê a consultoria aqui); sem o envio ligado devolve nulo. */
    public Preparado preparar(UUID consultoriaId, String anterior, String novo) {
        EnviadorDeEmail envio = emails.getIfAvailable();
        if (envio == null) {
            return null;
        }
        Consultoria consultoria = consultorias.findById(consultoriaId).orElse(null);
        String nome = consultoria == null ? null : consultoria.getNome();
        var remetente = consultoria == null ? null : RemetenteDaConsultoria.de(consultoria);
        return new Preparado(envio,
                mensagem(anterior, nome, remetente, "O e-mail de acesso à sua conta no app", "foi trocado pela sua equipe. A partir de agora o acesso é por outro endereço de e-mail.",
                        "Se você não esperava essa mudança, fale com a sua equipe."),
                mensagem(novo, nome, remetente, "Este endereço de e-mail passou a ser o de acesso à sua conta no app", "por decisão da sua equipe.",
                        "Use-o para entrar no app. Sua senha não mudou."));
    }

    /**
     * Envia depois do commit, sem tocar no banco. O aviso ao endereço anterior sai primeiro e não conta; o resultado é só o do
     * endereço NOVO: {@code true} se o provedor aceitou. Falha nunca sobe: a troca já está gravada.
     */
    public boolean enviar(Preparado preparado) {
        tentar(preparado.envio(), preparado.anterior());
        return tentar(preparado.envio(), preparado.novo());
    }

    private static boolean tentar(EnviadorDeEmail envio, EnviadorDeEmail.Mensagem mensagem) {
        try {
            envio.enviar(mensagem);
            return true;
        } catch (RuntimeException falha) {
            LOG.warn("E-mail de acesso trocado, mas o aviso não foi enviado ({}).", falha.getClass().getSimpleName());
            return false;
        }
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
