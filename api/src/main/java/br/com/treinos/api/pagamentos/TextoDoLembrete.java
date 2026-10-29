package br.com.treinos.api.pagamentos;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * O texto fixo do lembrete de cobrança: o mesmo no e-mail automático e na mensagem do WhatsApp que o treinador manda à mão.
 * Só o primeiro nome do aluno, o nome da consultoria, o valor, o vencimento e o endereço da Conta do aluno no app (onde ele
 * vê a cobrança). Nada de saúde, plano de treino, link de pagamento nem dado de outra pessoa. Nada daqui vai a log.
 */
public final class TextoDoLembrete {

    private static final DateTimeFormatter DIA_MES = DateTimeFormatter.ofPattern("dd/MM", Locale.ROOT);
    /** Onde o aluno vê as cobranças no app. */
    static final String CAMINHO_DA_CONTA = "/aluno/conta";

    /** O que entra no texto. {@code appUrl} vazio = sem a linha do link. */
    public record Dados(String nomeDoAluno, String nomeDaConsultoria, long valorCentavos, LocalDate vencimento,
                        String appUrl) {

        @Override
        public String toString() {
            return "Dados[...]";
        }
    }

    /** Assunto, texto puro e HTML do e-mail. */
    public record Mensagem(String assunto, String texto, String html) {

        @Override
        public String toString() {
            return "Mensagem[...]";
        }
    }

    private TextoDoLembrete() {
    }

    public static Mensagem email(TipoDeLembrete tipo, Dados d) {
        List<String> paragrafos = paragrafos(tipo, d);
        String assunto = "Lembrete de mensalidade" + (vazio(d.nomeDaConsultoria()) ? "" : " - " + umaLinha(d.nomeDaConsultoria()));
        StringBuilder html = new StringBuilder("<!doctype html><html><body style=\"font-family:sans-serif\">");
        String link = link(d.appUrl());
        for (String p : paragrafos) {
            if (link != null && p.endsWith(link)) {
                String antes = p.substring(0, p.length() - link.length());
                html.append("<p>").append(escapar(antes)).append("<a href=\"").append(escapar(link)).append("\">")
                        .append(escapar(link)).append("</a></p>");
            } else {
                html.append("<p>").append(escapar(p)).append("</p>");
            }
        }
        html.append("</body></html>");
        return new Mensagem(assunto, String.join("\n\n", paragrafos), html.toString());
    }

    /** A mensagem pronta do WhatsApp: as mesmas frases do e-mail. */
    public static String mensagem(TipoDeLembrete tipo, Dados d) {
        return String.join("\n\n", paragrafos(tipo, d));
    }

    static List<String> paragrafos(TipoDeLembrete tipo, Dados d) {
        List<String> p = new ArrayList<>();
        String nome = primeiroNome(d.nomeDoAluno());
        p.add(nome == null ? "Olá." : "Olá, " + nome + ".");
        String consultoria = vazio(d.nomeDaConsultoria()) ? "sua consultoria" : umaLinha(d.nomeDaConsultoria());
        String data = d.vencimento().format(DIA_MES);
        String inicio = "A mensalidade de " + consultoria + " no valor de " + valor(d.valorCentavos());
        p.add(switch (tipo) {
            case ANTES -> inicio + " vence em " + data + ".";
            case NO_DIA -> inicio + " vence hoje (" + data + ").";
            case DEPOIS -> inicio + " venceu em " + data + " e ainda está em aberto. Se você já pagou, desconsidere esta mensagem.";
        });
        String link = link(d.appUrl());
        if (link != null) {
            p.add("Veja a cobrança no app, na sua Conta: " + link);
        }
        return p;
    }

    /** O primeiro nome (o resto do nome não vai a e-mail nenhum); nulo sem nome. */
    static String primeiroNome(String nome) {
        if (vazio(nome)) {
            return null;
        }
        return umaLinha(nome).split(" ", 2)[0];
    }

    /** {@code R$ 1.234,56}, com espaço comum (o NumberFormat põe espaço inseparável, que o WhatsApp mostra diferente). */
    static String valor(long centavos) {
        long abs = Math.abs(centavos);
        String inteiros = String.format(Locale.ROOT, "%,d", abs / 100).replace(',', '.');
        return (centavos < 0 ? "-" : "") + "R$ " + inteiros + "," + String.format(Locale.ROOT, "%02d", abs % 100);
    }

    static String link(String appUrl) {
        if (vazio(appUrl)) {
            return null;
        }
        return appUrl.trim().replaceAll("/+$", "") + CAMINHO_DA_CONTA;
    }

    /** Sem quebra de linha nem controle no meio do texto (um nome assim não muda o assunto do e-mail). */
    private static String umaLinha(String texto) {
        return texto.replaceAll("[\\p{Cntrl}\\s]+", " ").trim();
    }

    private static boolean vazio(String texto) {
        return texto == null || texto.isBlank();
    }

    private static String escapar(String texto) {
        return texto.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
