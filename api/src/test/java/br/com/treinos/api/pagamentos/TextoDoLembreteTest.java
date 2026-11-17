package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** O texto fixo do lembrete: só o primeiro nome, a consultoria, o valor, o vencimento e o link da Conta; HTML escapado. */
class TextoDoLembreteTest {

    private static final TextoDoLembrete.Dados DADOS = new TextoDoLembrete.Dados("Ana Maria Teste", "Equipe Fictícia",
            123_456, LocalDate.parse("2027-03-05"), "https://app.teste.local/", 1, true);

    @Test
    void antesNoDiaEDepois() {
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.ANTES, DADOS)).isEqualTo(
                "Olá, Ana.\n\nA mensalidade de Equipe Fictícia no valor de R$ 1.234,56 vence em 05/03.\n\n"
                        + "Veja a cobrança no app, na sua Conta: https://app.teste.local/aluno/conta");
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.NO_DIA, DADOS)).contains("vence hoje (05/03).");
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.DEPOIS, DADOS))
                .contains("venceu em 05/03 e ainda está em aberto. Se você já pagou, desconsidere esta mensagem.");
    }

    @Test
    void oEmailTemOMesmoTextoEOLinkNoHtml() {
        var email = TextoDoLembrete.email(TipoDeLembrete.ANTES, DADOS);
        assertThat(email.texto()).isEqualTo(TextoDoLembrete.mensagem(TipoDeLembrete.ANTES, DADOS));
        assertThat(email.assunto()).isEqualTo("Lembrete de mensalidade - Equipe Fictícia");
        assertThat(email.html()).contains("<a href=\"https://app.teste.local/aluno/conta\">").doesNotContain("Maria");
        assertThat(email.toString()).doesNotContain("Ana");
    }

    @Test
    void escapaOHtmlEUmNomeComQuebraNaoMudaOAssunto() {
        var dados = new TextoDoLembrete.Dados("<b>Zé</b>", "Treino\r\nBcc: x@y.z <i>", 5000, LocalDate.parse("2027-12-31"), "", 1, true);
        var email = TextoDoLembrete.email(TipoDeLembrete.NO_DIA, dados);
        assertThat(email.assunto()).doesNotContain("\n").doesNotContain("\r");
        assertThat(email.html()).doesNotContain("<b>").doesNotContain("<i>").contains("&lt;b&gt;");
        assertThat(email.texto()).doesNotContain("/aluno/conta").contains("R$ 50,00").contains("31/12");
    }

    @Test
    void semNomeSemConsultoriaEValores() {
        var dados = new TextoDoLembrete.Dados("  ", null, 7, LocalDate.parse("2027-01-01"), null, 1, true);
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.ANTES, dados))
                .startsWith("Olá.\n\nA mensalidade de sua consultoria no valor de R$ 0,07 vence em 01/01.");
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
        assertThat(TextoDoLembrete.email(TipoDeLembrete.DEPOIS, tres).html()).contains("<a href=\"https://app.teste.local/aluno/conta\">");
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.DEPOIS, DADOS)).doesNotContain("em aberto no total");
    }

    @Test
    void cobrancaAvulsaUsaOTermoCobrancaEMantemOResto() {
        var avulsa = new TextoDoLembrete.Dados("Ana Maria Teste", "Equipe Fictícia", 5_000, LocalDate.parse("2027-03-05"),
                "", 1, false);
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.ANTES, avulsa))
                .contains("A cobrança de Equipe Fictícia no valor de R$ 50,00 vence em 05/03.").doesNotContainIgnoringCase("mensalidade");
        assertThat(TextoDoLembrete.email(TipoDeLembrete.ANTES, avulsa).assunto()).isEqualTo("Lembrete de cobrança - Equipe Fictícia");
    }
}
