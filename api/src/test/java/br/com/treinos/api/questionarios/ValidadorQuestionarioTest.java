package br.com.treinos.api.questionarios;

import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Pergunta;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Secao;
import org.junit.jupiter.api.Test;

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

    @Test
    void tamanhoDoRascunhoContaBytesUtf8() {
        String limite = "a".repeat(LimitesQuestionario.RASCUNHO_BYTES);
        assertThat(ValidadorQuestionario.excedeTamanhoDoRascunho(limite)).isFalse();
        assertThat(ValidadorQuestionario.excedeTamanhoDoRascunho(limite + "a")).isTrue();
        // "ã" ocupa 2 bytes: metade dos caracteres já estoura.
        assertThat(ValidadorQuestionario.excedeTamanhoDoRascunho("ã".repeat(LimitesQuestionario.RASCUNHO_BYTES / 2 + 1))).isTrue();
    }
}
