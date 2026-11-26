package br.com.treinos.api.planos;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Regra pura do título que o aluno vê na publicação. Nomes fictícios. */
class TituloDoPlanoPublicadoTest {

    private static String dieta(String titulo, String nome) {
        return TituloDoPlanoPublicado.de(titulo, "Dieta", nome);
    }

    @Test
    void tiraORascunhoSemDiferencaDeCaixaNemEspacos() {
        assertThat(dieta("Dieta A (rascunho)", "Ana")).isEqualTo("Dieta A");
        assertThat(dieta("x (RASCUNHO)", "Ana")).isEqualTo("x");
        assertThat(dieta("  Dieta   A  ( Rascunho )  ", "Ana")).isEqualTo("Dieta A");
        assertThat(dieta("Dieta (rascunho) de cutting", "Ana")).isEqualTo("Dieta de cutting");
    }

    @Test
    void padraoDaImportacaoViraTipoDeNomeDoAluno() {
        assertThat(dieta("Importada da planilha (rascunho)", "Ana Lima")).isEqualTo("Dieta de Ana Lima");
        assertThat(dieta("Importada da planilha", "Ana Lima")).isEqualTo("Dieta de Ana Lima");
        assertThat(dieta("  IMPORTADA  da   planilha (Rascunho)", "  Ana   Lima ")).isEqualTo("Dieta de Ana Lima");
        assertThat(TituloDoPlanoPublicado.de("Importada da planilha (rascunho)", "Treino", "Ana Lima"))
                .isEqualTo("Treino de Ana Lima");
    }

    @Test
    void tituloDoTreinadorFicaComoEsta() {
        assertThat(dieta("Dieta do Saraiva", "Ana")).isEqualTo("Dieta do Saraiva");
        assertThat(dieta("Importada da planilha 2", "Ana")).isEqualTo("Importada da planilha 2");
    }

    @Test
    void tituloVazioNuloOuSoRascunhoUsaOPadraoDoAluno() {
        assertThat(dieta(null, "Ana")).isEqualTo("Dieta de Ana");
        assertThat(dieta("  ", "Ana")).isEqualTo("Dieta de Ana");
        assertThat(dieta("(rascunho)", "Ana")).isEqualTo("Dieta de Ana");
    }

    @Test
    void semNomeDoAlunoUsaOFormatoGenericoDoApp() {
        assertThat(dieta("Importada da planilha", null)).isEqualTo("Dieta do aluno");
        assertThat(TituloDoPlanoPublicado.de("(rascunho)", "Treino", "  ")).isEqualTo("Treino do aluno");
    }

    @Test
    void nomeLongoCortaONomeEMantemOTituloNoMaximo() {
        String longo = "Maria ".repeat(40);
        String titulo = dieta("Importada da planilha (rascunho)", longo);
        assertThat(titulo).startsWith("Dieta de Maria Maria").hasSizeLessThanOrEqualTo(TituloDoPlanoPublicado.MAXIMO)
                .doesNotEndWith(" ");
        assertThat(titulo.length()).isGreaterThan(TituloDoPlanoPublicado.MAXIMO - 10);
    }

    @Test
    void pastaUsaOMesmoCaminhoComPlanoDeNome() {
        assertThat(TituloDoPlanoPublicado.de("Importada da planilha (rascunho)", "Plano", "Ana Lima")).isEqualTo("Plano de Ana Lima");
        assertThat(TituloDoPlanoPublicado.de("Importada da planilha (rascunho)", "Plano", null)).isEqualTo("Plano do aluno");
        assertThat(TituloDoPlanoPublicado.de("Plano 16 (rascunho)", "Plano", "Ana")).isEqualTo("Plano 16");
        assertThat(TituloDoPlanoPublicado.de("Plano 16", "Plano", "Ana")).isEqualTo("Plano 16");
        // Plano Atual (Importado) da importação assistida não é o nome padrão: fica como está.
        assertThat(TituloDoPlanoPublicado.de("Plano Atual (Importado)", "Plano", "Ana")).isEqualTo("Plano Atual (Importado)");
        assertThat(TituloDoPlanoPublicado.de("Importada da planilha (rascunho)", "Plano", "Maria ".repeat(40)))
                .startsWith("Plano de Maria").hasSizeLessThanOrEqualTo(TituloDoPlanoPublicado.MAXIMO);
    }
}
