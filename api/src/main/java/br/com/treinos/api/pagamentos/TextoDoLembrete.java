package br.com.treinos.api.pagamentos;

import br.com.treinos.api.consultoria.MarcaPublica;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * O texto fixo do lembrete de cobrança: o mesmo no e-mail automático e na mensagem do WhatsApp que o treinador manda à mão.
 * Só o primeiro nome do aluno, o nome da consultoria, o valor, o vencimento e o endereço da Conta do aluno no app (onde ele
 * vê a cobrança), depois da frase fixa {@link #FRASE_DO_APP}. Nada de saúde, plano de treino, botão ou link de pagamento nem
 * dado de outra pessoa. Nada daqui vai a log. Com mais de uma cobrança em aberto o aluno recebe um e-mail só (o da mais antiga,
 * escolhida em {@link LembretesDeCobranca}) e o texto diz quantas estão em aberto. O HTML do e-mail leva a marca (decisão de
 * 28/11): a logo pela rota pública ({@code /publico/marcas/{id}/logo}) quando há endereço https, senão o nome da consultoria,
 * e a cor da marca escurecida até 4,5:1 sobre o papel branco (o {@code marcaParaTexto} do app, {@code tema/tokens.ts}).
 * O app espelha o texto em {@code dominio/telaDosLembretes.ts}: mudou aqui, mude lá.
 */
public final class TextoDoLembrete {

    private static final DateTimeFormatter DIA_MES = DateTimeFormatter.ofPattern("dd/MM", Locale.ROOT);
    /** Onde o aluno vê as cobranças no app. */
    static final String CAMINHO_DA_CONTA = "/aluno/conta";
    /** A frase fixa antes do endereço da Conta (Gustavo, 28/11): o app mostra como pagar; o lembrete nunca leva pagamento. */
    static final String FRASE_DO_APP = "Abra o app para ver como pagar";
    /** A API sai em {@code APP_URL/api} (Caddy local e da produção). */
    static final String PREFIXO_DA_API = "/api";
    private static final String PAPEL = "#FFFFFF";
    private static final String TINTA = "#111111";
    private static final Pattern COR = Pattern.compile("^#[0-9A-Fa-f]{6}$");

    /**
     * O que entra no texto. {@code appUrl} vazio = sem a linha do link; {@code emAberto} = cobranças em aberto do aluno (a desta
     * inclusive; acima de 1 o texto o diz); {@code mensalidade} falso (cobrança avulsa) troca "mensalidade" por "cobrança".
     */
    public record Dados(String nomeDoAluno, String nomeDaConsultoria, long valorCentavos, LocalDate vencimento,
                        String appUrl, int emAberto, boolean mensalidade) {

        @Override
        public String toString() {
            return "Dados[...]";
        }
    }

    /**
     * A marca no topo do e-mail: {@code cor} {@code #RRGGBB} (outra coisa vira a tinta do texto) e {@code logoUrl} absoluta
     * https (outra coisa, ou nula, mostra o nome da consultoria no lugar; ver {@link #logoUrl}).
     */
    public record Marca(String cor, String logoUrl) {
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

    public static Mensagem email(TipoDeLembrete tipo, Dados d, Marca marca) {
        List<String> paragrafos = paragrafos(tipo, d);
        String assunto = (d.mensalidade() ? "Lembrete de mensalidade" : "Lembrete de cobrança") + (vazio(d.nomeDaConsultoria()) ? "" : " - " + umaLinha(d.nomeDaConsultoria()));
        String cor = corParaTexto(marca == null ? null : marca.cor());
        StringBuilder html = new StringBuilder("<!doctype html><html><body style=\"margin:0;padding:0;background:" + PAPEL
                + ";color:" + TINTA + ";font-family:sans-serif\"><div style=\"max-width:560px;margin:0 auto;padding:24px\">");
        topo(html, d.nomeDaConsultoria(), marca == null ? null : marca.logoUrl(), cor);
        String link = link(d.appUrl());
        for (String p : paragrafos) {
            if (link != null && p.endsWith(link)) {
                String antes = p.substring(0, p.length() - link.length());
                // Link comum sublinhado para a Conta no app; nunca botão (sem fundo nem preenchimento).
                html.append("<p>").append(escapar(antes)).append("<a href=\"").append(escapar(link)).append("\" style=\"color:")
                        .append(cor).append(";text-decoration:underline\">").append(escapar(link)).append("</a></p>");
            } else {
                html.append("<p>").append(escapar(p)).append("</p>");
            }
        }
        html.append("</div></body></html>");
        return new Mensagem(assunto, String.join("\n\n", paragrafos), html.toString());
    }

    /** Logo (com o nome no {@code alt}, para quem bloqueia imagens) ou o nome na cor da marca, sobre um fio da mesma cor. */
    private static void topo(StringBuilder html, String nomeDaConsultoria, String logoUrl, String cor) {
        String nome = vazio(nomeDaConsultoria) ? null : umaLinha(nomeDaConsultoria);
        boolean comLogo = logoUrl != null && logoUrl.startsWith("https://");
        if (nome == null && !comLogo) {
            return;
        }
        html.append("<div style=\"border-bottom:3px solid ").append(cor).append(";padding-bottom:12px;margin-bottom:16px\">");
        if (comLogo) {
            html.append("<img src=\"").append(escapar(logoUrl)).append("\" alt=\"").append(nome == null ? "" : escapar(nome))
                    .append("\" height=\"40\" style=\"height:40px;max-width:200px;display:block;border:0\">");
        } else {
            html.append("<p style=\"margin:0;font-size:20px;font-weight:bold;color:").append(cor).append("\">")
                    .append(escapar(nome)).append("</p>");
        }
        html.append("</div>");
    }

    /**
     * Endereço absoluto da logo para o e-mail: {@code APP_URL} + {@code /api} + a rota pública da logo; nulo sem logo ou sem
     * {@code APP_URL} https (e-mail não carrega imagem de endereço relativo, e o {@code http} local não vale).
     */
    static String logoUrl(String appUrl, UUID consultoriaId, String logoTipo, int logoVersao) {
        String caminho = MarcaPublica.logoUrl(consultoriaId, logoTipo, logoVersao);
        if (caminho == null || vazio(appUrl) || !appUrl.trim().startsWith("https://")) {
            return null;
        }
        return appUrl.trim().replaceAll("/+$", "") + PREFIXO_DA_API + caminho;
    }

    /** A mensagem pronta do WhatsApp: as mesmas frases do e-mail. */
    public static String mensagem(TipoDeLembrete tipo, Dados d) {
        return String.join("\n\n", paragrafos(tipo, d));
    }

    /**
     * A mensagem da cobrança de saída (só WhatsApp à mão, sem e-mail nem link): primeiro nome, consultoria, valor e vencimento,
     * sem a palavra "mensalidade" (não é uma). {@code appUrl} é ignorado.
     */
    public static String mensagemDeSaida(Dados d) {
        String nome = primeiroNome(d.nomeDoAluno());
        String consultoria = vazio(d.nomeDaConsultoria()) ? "sua consultoria" : umaLinha(d.nomeDaConsultoria());
        return String.join("\n\n", nome == null ? "Olá." : "Olá, " + nome + ".",
                "Conforme combinado na saída de " + consultoria + ", há uma cobrança de " + valor(d.valorCentavos())
                        + " com vencimento em " + d.vencimento().format(DIA_MES)
                        + ". Se você já pagou, desconsidere esta mensagem.");
    }

    static List<String> paragrafos(TipoDeLembrete tipo, Dados d) {
        List<String> p = new ArrayList<>();
        String nome = primeiroNome(d.nomeDoAluno());
        p.add(nome == null ? "Olá." : "Olá, " + nome + ".");
        String consultoria = vazio(d.nomeDaConsultoria()) ? "sua consultoria" : umaLinha(d.nomeDaConsultoria());
        String data = d.vencimento().format(DIA_MES);
        String inicio = (d.mensalidade() ? "A mensalidade de " : "A cobrança de ") + consultoria + " no valor de " + valor(d.valorCentavos());
        p.add(switch (tipo) {
            case ANTES -> inicio + " vence em " + data + ".";
            case NO_DIA -> inicio + " vence hoje (" + data + ").";
            case DEPOIS -> inicio + " venceu em " + data + " e ainda está em aberto. Se você já pagou, desconsidere esta mensagem.";
        });
        if (d.emAberto() > 1) {
            p.add("Você tem " + d.emAberto() + " cobranças em aberto no total.");
        }
        String link = link(d.appUrl());
        if (link != null) {
            p.add(FRASE_DO_APP + ": " + link);
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

    // ---- Cor da marca como texto no papel branco (espelho de `marcaParaTexto` do app, `tema/tokens.ts`) ----

    /** A cor da marca quando já dá 4,5:1 no branco; senão a mistura com preto mais próxima que chega lá. Fora de #RRGGBB, a tinta. */
    static String corParaTexto(String marca) {
        if (marca == null || !COR.matcher(marca.trim()).matches()) {
            return TINTA;
        }
        String cor = marca.trim().toUpperCase(Locale.ROOT);
        for (int passo = 0; passo <= 25; passo++) {
            String misturada = misturar(cor, "#000000", Math.min(passo * 0.04, 1));
            if (contraste(misturada, PAPEL) >= 4.5) {
                return misturada;
            }
        }
        return "#000000";
    }

    private static double luminancia(String hex) {
        int n = Integer.parseInt(hex.substring(1), 16);
        double[] c = new double[3];
        for (int i = 0; i < 3; i++) {
            double s = ((n >> (16 - 8 * i)) & 255) / 255.0;
            c[i] = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        }
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }

    private static double contraste(String a, String b) {
        double la = luminancia(a);
        double lb = luminancia(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    private static String misturar(String cor, String alvo, double t) {
        int a = Integer.parseInt(cor.substring(1), 16);
        int b = Integer.parseInt(alvo.substring(1), 16);
        StringBuilder s = new StringBuilder("#");
        for (int desl = 16; desl >= 0; desl -= 8) {
            long canal = Math.round(((a >> desl) & 255) * (1 - t) + ((b >> desl) & 255) * t);
            s.append(String.format(Locale.ROOT, "%02X", canal));
        }
        return s.toString();
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
