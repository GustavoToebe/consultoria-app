package br.com.treinos.api.importacao.assistida.ia;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Dúvida sem termo (em branco, "**", "-", "—") é descartada; trecho em branco com termo válido fica. Dados fictícios. */
class DecodificadorDaPropostaTest {

    private final JsonMapper json = JsonMapper.builder().build();

    private ResultadoInterpretacao decodificar(String duvidas) {
        var contexto = new ContextoIa("a.txt", "TEXTO_LIVRE", List.of(), "texto", null, List.of(), Map.of());
        return DecodificadorDaProposta.decodificar(json, json.readTree("{\"grupos\":[],\"duvidas\":" + duvidas + "}"), contexto);
    }

    @Test
    void termoVazioEsoPontuacaoSaemEOTermoValidoFica() {
        var r = decodificar("""
                [{"tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"","trechoOriginal":"3x10"},
                 {"tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"   ","trechoOriginal":"3x10"},
                 {"tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"**","trechoOriginal":"3x10"},
                 {"tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"-","trechoOriginal":"3x10"},
                 {"tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":" — * ","trechoOriginal":"3x10"},
                 {"tipo":"EXERCICIO_NAO_RECONHECIDO","trechoOriginal":"3x10"},
                 {"tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"Puxada frent","trechoOriginal":"3x10"}]
                """);

        assertThat(r.duvidas()).hasSize(1);
        assertThat(r.duvidas().getFirst().termoOriginal()).isEqualTo("Puxada frent");
    }

    @Test
    void trechoEmBrancoComTermoValidoFicaComTrechoVazio() {
        var r = decodificar("""
                [{"tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"Rosca 21","trechoOriginal":"  "},
                 {"tipo":"EXERCICIO_NAO_RECONHECIDO","termoOriginal":"Rosca 45"}]
                """);

        assertThat(r.duvidas()).hasSize(2);
        assertThat(r.duvidas()).allSatisfy(d -> assertThat(d.trechoOriginal()).isBlank());
    }

    @Test
    void semConteudoReconheceLetraEDigito() {
        assertThat(TermoDeDuvida.semConteudo(null)).isTrue();
        assertThat(TermoDeDuvida.semConteudo("***")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("(…)")).isTrue();
        assertThat(TermoDeDuvida.semConteudo("21")).isFalse();
        assertThat(TermoDeDuvida.semConteudo("Remada")).isFalse();
    }
}
