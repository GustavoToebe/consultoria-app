package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * O texto fixo do lembrete: só o primeiro nome, a consultoria, o valor, o vencimento e o link da Conta depois de "Abra o app
 * para ver como pagar"; HTML escapado, com a marca (logo ou nome, cor com 4,5:1 no branco) e nunca botão nem link de pagamento.
 */
class TextoDoLembreteTest {

    private static final TextoDoLembrete.Dados DADOS = new TextoDoLembrete.Dados("Ana Maria Teste", "Equipe Fictícia",
            123_456, LocalDate.parse("2027-03-05"), "https://app.teste.local/", 1, true);
    private static final TextoDoLembrete.Marca SEM_LOGO = new TextoDoLembrete.Marca("#FFD60A", null);

    @Test
    void antesNoDiaEDepois() {
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.ANTES, DADOS)).isEqualTo(
                "Olá, Ana.\n\nA mensalidade de Equipe Fictícia no valor de R$ 1.234,56 vence em 05/03.\n\n"
                        + "Abra o app para ver como pagar: https://app.teste.local/aluno/conta");
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.NO_DIA, DADOS)).contains("vence hoje (05/03).");
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.DEPOIS, DADOS))
                .contains("venceu em 05/03 e ainda está em aberto. Se você já pagou, desconsidere esta mensagem.");
    }

    @Test
    void oEmailTemOMesmoTextoEOLinkNoHtml() {
        var email = TextoDoLembrete.email(TipoDeLembrete.ANTES, DADOS, SEM_LOGO);
        assertThat(email.texto()).isEqualTo(TextoDoLembrete.mensagem(TipoDeLembrete.ANTES, DADOS));
        assertThat(email.assunto()).isEqualTo("Lembrete de mensalidade - Equipe Fictícia");
        assertThat(email.html()).contains("<a href=\"https://app.teste.local/aluno/conta\"").contains("Abra o app para ver como pagar: ")
                .doesNotContain("Maria");
        assertThat(email.toString()).doesNotContain("Ana");
    }

    @Test
    void nuncaBotaoNemLinkDePagamentoSoOLinkDaConta() {
        var html = TextoDoLembrete.email(TipoDeLembrete.DEPOIS, DADOS, new TextoDoLembrete.Marca("#22C55E",
                "https://app.teste.local/api/publico/marcas/x/logo?v=1")).html();
        assertThat(html.split("<a ", -1)).hasSize(2);
        assertThat(html).contains("<a href=\"https://app.teste.local/aluno/conta\"").doesNotContainIgnoringCase("button")
                .doesNotContainIgnoringCase("botão").doesNotContainIgnoringCase("pagar agora").doesNotContain("infinitepay")
                .doesNotContain("pix").doesNotContain("background:#178640");
    }

    @Test
    void semLogoONomeNaCorDaMarcaComContraste() {
        String html = TextoDoLembrete.email(TipoDeLembrete.ANTES, DADOS, SEM_LOGO).html();
        assertThat(html).doesNotContain("<img").contains("color:#856F05\">Equipe Fictícia</p>")
                .contains("border-bottom:3px solid #856F05").contains("text-decoration:underline");
    }

    @Test
    void comLogoAImagemComONomeNoAlt() {
        String html = TextoDoLembrete.email(TipoDeLembrete.ANTES, DADOS,
                new TextoDoLembrete.Marca("#1A1A2E", "https://app.teste.local/api/publico/marcas/abc/logo?v=2&x=\"1\"")).html();
        assertThat(html).contains("<img src=\"https://app.teste.local/api/publico/marcas/abc/logo?v=2&amp;x=&quot;1&quot;\" alt=\"Equipe Fictícia\"")
                .doesNotContain("x=\"1\"").contains("border-bottom:3px solid #1A1A2E");
        // Logo fora de https não entra: volta o nome.
        String http = TextoDoLembrete.email(TipoDeLembrete.ANTES, DADOS, new TextoDoLembrete.Marca("#1A1A2E", "http://x/logo")).html();
        assertThat(http).doesNotContain("<img").contains(">Equipe Fictícia</p>");
    }

    @Test
    void oEnderecoDaLogoSoComAppUrlHttpsEComLogo() {
        UUID id = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
        assertThat(TextoDoLembrete.logoUrl("https://overtraining.app/", id, "image/png", 3))
                .isEqualTo("https://overtraining.app/api/publico/marcas/" + id + "/logo?v=3");
        assertThat(TextoDoLembrete.logoUrl("http://localhost:8088", id, "image/png", 3)).isNull();
        assertThat(TextoDoLembrete.logoUrl("", id, "image/png", 3)).isNull();
        assertThat(TextoDoLembrete.logoUrl("https://overtraining.app", id, null, 3)).isNull();
    }

    /** Os mesmos casos de `telaDosLembretes.test.ts` (paridade com o `marcaParaTexto` do app sobre o branco). */
    @Test
    void corDaMarcaComoOApp() {
        assertThat(TextoDoLembrete.corParaTexto("#FFD60A")).isEqualTo("#856F05");
        assertThat(TextoDoLembrete.corParaTexto("#1A1A2E")).isEqualTo("#1A1A2E");
        assertThat(TextoDoLembrete.corParaTexto("#22C55E")).isEqualTo("#178640");
        assertThat(TextoDoLembrete.corParaTexto("#ffffff")).isEqualTo("#707070");
        // Fora de #RRGGBB (nunca entra no style): a tinta do texto.
        assertThat(TextoDoLembrete.corParaTexto("red;background:url(x)")).isEqualTo("#111111");
        assertThat(TextoDoLembrete.corParaTexto(null)).isEqualTo("#111111");
        assertThat(TextoDoLembrete.email(TipoDeLembrete.ANTES, DADOS, new TextoDoLembrete.Marca("red\"><script>", null)).html())
                .doesNotContain("<script>").contains("solid #111111");
    }

    @Test
    void escapaOHtmlEUmNomeComQuebraNaoMudaOAssunto() {
        var dados = new TextoDoLembrete.Dados("<b>Zé</b>", "Treino\r\nBcc: x@y.z <i>", 5000, LocalDate.parse("2027-12-31"), "", 1, true);
        var email = TextoDoLembrete.email(TipoDeLembrete.NO_DIA, dados, new TextoDoLembrete.Marca("#1A1A2E", "https://a.test/logo"));
        assertThat(email.assunto()).doesNotContain("\n").doesNotContain("\r");
        assertThat(email.html()).doesNotContain("<b>").doesNotContain("<i>").contains("&lt;b&gt;").contains("alt=\"Treino Bcc: x@y.z &lt;i&gt;\"");
        assertThat(email.texto()).doesNotContain("/aluno/conta").doesNotContain("Abra o app").contains("R$ 50,00").contains("31/12");
    }

    @Test
    void semNomeSemConsultoriaEValores() {
        var dados = new TextoDoLembrete.Dados("  ", null, 7, LocalDate.parse("2027-01-01"), null, 1, true);
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.ANTES, dados))
                .startsWith("Olá.\n\nA mensalidade de sua consultoria no valor de R$ 0,07 vence em 01/01.");
        // Sem nome e sem logo, o topo da marca não aparece.
        assertThat(TextoDoLembrete.email(TipoDeLembrete.ANTES, dados, null).html()).doesNotContain("border-bottom");
        assertThat(TextoDoLembrete.valor(100_000_000L)).isEqualTo("R$ 1.000.000,00");
        assertThat(TextoDoLembrete.valor(99)).isEqualTo("R$ 0,99");
    }

    @Test
    void aMensagemDeSaidaNaoFalaDeMensalidadeNemLevaLink() {
        String texto = TextoDoLembrete.mensagemDeSaida(DADOS);
        assertThat(texto).isEqualTo("Olá, Ana.\n\nConforme combinado na saída de Equipe Fictícia, há uma cobrança de "
                + "R$ 1.234,56 com vencimento em 05/03. Se você já pagou, desconsidere esta mensagem.");
        assertThat(texto).doesNotContainIgnoringCase("mensalidade").doesNotContain("http").doesNotContain("Maria");
    }

    @Test
    void maisDeUmaEmAbertoDizQuantasSaoEUmaSoNaoDiz() {
        var tres = new TextoDoLembrete.Dados("Ana Maria Teste", "Equipe Fictícia", 123_456, LocalDate.parse("2027-03-05"),
                "https://app.teste.local/", 3, true);
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.DEPOIS, tres)).contains("Você tem 3 cobranças em aberto no total.")
                .endsWith("https://app.teste.local/aluno/conta");
        assertThat(TextoDoLembrete.email(TipoDeLembrete.DEPOIS, tres, SEM_LOGO).html()).contains("<a href=\"https://app.teste.local/aluno/conta\"");
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.DEPOIS, DADOS)).doesNotContain("em aberto no total");
    }

    @Test
    void cobrancaAvulsaUsaOTermoCobrancaEMantemOResto() {
        var avulsa = new TextoDoLembrete.Dados("Ana Maria Teste", "Equipe Fictícia", 5_000, LocalDate.parse("2027-03-05"),
                "", 1, false);
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.ANTES, avulsa))
                .contains("A cobrança de Equipe Fictícia no valor de R$ 50,00 vence em 05/03.").doesNotContainIgnoringCase("mensalidade");
        assertThat(TextoDoLembrete.email(TipoDeLembrete.ANTES, avulsa, SEM_LOGO).assunto()).isEqualTo("Lembrete de cobrança - Equipe Fictícia");
    }
}
