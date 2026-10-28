package br.com.treinos.api.pagamentos;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/** O texto fixo do lembrete: só o primeiro nome, a consultoria, o valor, o vencimento e o link da Conta; HTML escapado. */
class TextoDoLembreteTest {

    private static final TextoDoLembrete.Dados DADOS = new TextoDoLembrete.Dados("Ana Maria Teste", "Equipe Fictícia",
            123_456, LocalDate.parse("2027-03-05"), "https://app.teste.local/");

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
        var dados = new TextoDoLembrete.Dados("<b>Zé</b>", "Treino\r\nBcc: x@y.z <i>", 5000, LocalDate.parse("2027-12-31"), "");
        var email = TextoDoLembrete.email(TipoDeLembrete.NO_DIA, dados);
        assertThat(email.assunto()).doesNotContain("\n").doesNotContain("\r");
        assertThat(email.html()).doesNotContain("<b>").doesNotContain("<i>").contains("&lt;b&gt;");
        assertThat(email.texto()).doesNotContain("/aluno/conta").contains("R$ 50,00").contains("31/12");
    }

    @Test
    void semNomeSemConsultoriaEValores() {
        var dados = new TextoDoLembrete.Dados("  ", null, 7, LocalDate.parse("2027-01-01"), null);
        assertThat(TextoDoLembrete.mensagem(TipoDeLembrete.ANTES, dados))
                .startsWith("Olá.\n\nA mensalidade de sua consultoria no valor de R$ 0,07 vence em 01/01.");
        assertThat(TextoDoLembrete.valor(100_000_000L)).isEqualTo("R$ 1.000.000,00");
        assertThat(TextoDoLembrete.valor(99)).isEqualTo("R$ 0,99");
    }
}
