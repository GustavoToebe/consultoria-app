package br.com.treinos.api.questionarios;

import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Pergunta;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Secao;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** As regras uma a uma estão nas fixtures de paridade; aqui ficam o que não é regra de forma. Dados fictícios. */
class ValidadorQuestionarioTest {

    private final ValidadorQuestionario validador = new ValidadorQuestionario();

    private static Pergunta pergunta(String id, TipoPergunta tipo) {
        return new Pergunta(id, tipo, "Pergunta " + id, false, null, null, null, null, null, null, null, null, null, null);
    }

    private static ConteudoQuestionario conteudo(Pergunta... perguntas) {
        return new ConteudoQuestionario(2, List.of(), List.of(new Secao("s1", "Geral", List.of(perguntas))));
    }

    @Test
    void conteudoSemListasNaoQuebra() {
        ResultadoValidacao r = validador.validar(new ConteudoQuestionario(null, null, null));
        assertThat(r.erros()).extracting(ResultadoValidacao.Problema::caminho).containsExactly("secoes");
        assertThat(r.avisos()).isEmpty();
    }

    @Test
    void semPerguntaDePesoSoAvisa() {
        ResultadoValidacao r = validador.validar(conteudo(pergunta("a", TipoPergunta.NOTA)));
        assertThat(r.temErros()).isFalse();
        assertThat(r.temAvisos()).isTrue();
    }

    @Test
    void tipoDeUmIdNaoMudaEntreVersoes() {
        ConteudoQuestionario v1 = conteudo(pergunta("peso", TipoPergunta.PESO), pergunta("sono", TipoPergunta.NOTA));
        ConteudoQuestionario atual = conteudo(pergunta("peso", TipoPergunta.PESO), pergunta("sono", TipoPergunta.TEXTO),
                pergunta("novo", TipoPergunta.NUMERO));
        assertThat(ValidadorQuestionario.tiposQueMudaram(atual, List.of(v1))).containsExactly("sono");
        assertThat(ValidadorQuestionario.tiposQueMudaram(v1, List.of(v1))).isEmpty();
        assertThat(ValidadorQuestionario.tiposQueMudaram(atual, List.of())).isEmpty();
    }

    @Test
    void normalizaCaixaAcentoEEspacos() {
        assertThat(ValidadorQuestionario.normalizar("  Não ")).isEqualTo("nao");
    }

    private static Pergunta comLugares(TipoPergunta tipo, BigDecimal max, List<String> lugares) {
        return new Pergunta("f", tipo, "Fotos", false, null, null, null, null, null, null, null, null, max, null,
                null, null, null, null, null, null, null, null, null, null, null, lugares);
    }

    private static Pergunta fotos(BigDecimal max, List<String> lugares) {
        return comLugares(TipoPergunta.FOTOS, max, lugares);
    }

    private List<String> errosDe(Pergunta p) {
        return validador.validar(conteudo(pergunta("peso", TipoPergunta.PESO), p)).erros().stream()
                .map(ResultadoValidacao.Problema::caminho).sorted().toList();
    }

    @Test
    void lugaresDaPerguntaDeFotos() {
        String base = "secoes[0].perguntas[1].lugares";
        assertThat(errosDe(fotos(null, List.of("Frente", "Costas", "Lado direito")))).isEmpty();
        assertThat(errosDe(fotos(null, List.of(" Frente ", "frente")))).containsExactly(base + "[1]");
        assertThat(errosDe(fotos(null, List.of("Pé", "pe")))).containsExactly(base + "[1]"); // acento e caixa, como as opções
        assertThat(errosDe(fotos(null, List.of("  ", "a".repeat(41))))).containsExactly(base + "[0]", base + "[1]");
        assertThat(errosDe(fotos(null, List.of("a".repeat(40))))).isEmpty();
        assertThat(errosDe(fotos(BigDecimal.valueOf(2), List.of("a", "b", "c")))).containsExactly(base);
        assertThat(errosDe(fotos(null, List.of()))).containsExactly(base);
        assertThat(errosDe(comLugares(TipoPergunta.NOTA, null, List.of("a")))).containsExactly(base);
    }

    @Test
    void tamanhoDoRascunhoContaBytesUtf8() {
        String limite = "a".repeat(LimitesQuestionario.RASCUNHO_BYTES);
        assertThat(ValidadorQuestionario.excedeTamanhoDoRascunho(limite)).isFalse();
        assertThat(ValidadorQuestionario.excedeTamanhoDoRascunho(limite + "a")).isTrue();
        // "ã" ocupa 2 bytes: metade dos caracteres já estoura.
        assertThat(ValidadorQuestionario.excedeTamanhoDoRascunho("ã".repeat(LimitesQuestionario.RASCUNHO_BYTES / 2 + 1))).isTrue();
    }
}
