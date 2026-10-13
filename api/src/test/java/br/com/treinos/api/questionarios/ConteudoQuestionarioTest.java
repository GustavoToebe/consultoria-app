package br.com.treinos.api.questionarios;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Forma e tamanho do rascunho (Bean Validation) e leitura do JSON. Dados fictícios. */
class ConteudoQuestionarioTest {

    private final JsonMapper json = JsonMapper.builder().build();
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private ConteudoQuestionario ler(String texto) {
        return json.readValue(texto, ConteudoQuestionario.class);
    }

    @Test
    void rascunhoIncompletoPassaNaForma() {
        var c = ler("{\"formato\":2,\"secoes\":[{\"uid\":\"s1\",\"perguntas\":[{\"tipo\":\"NOTA\"}]}]}");
        assertThat(validator.validate(c)).isEmpty();
    }

    @Test
    void tipoDesconhecidoFalhaNaLeitura() {
        assertThatThrownBy(() -> ler("{\"secoes\":[{\"perguntas\":[{\"id\":\"a\",\"tipo\":\"VOADOR\"}]}]}"))
                .isInstanceOf(JacksonException.class);
    }

    @Test
    void chaveDesconhecidaEDescartadaEONuloNaoSaiNoJson() {
        var c = ler("{\"formato\":2,\"lixo\":1,\"secoes\":[{\"uid\":\"s1\",\"titulo\":\"T\",\"perguntas\":"
                + "[{\"id\":\"a\",\"tipo\":\"NOTA\",\"rotulo\":\"R\",\"extra\":true}]}]}");
        String saida = json.writeValueAsString(c);
        assertThat(saida).doesNotContain("lixo").doesNotContain("extra").doesNotContain("null");
    }

    @Test
    void tamanhosEIdsForaDoPadraoSaoRecusados() {
        var c = ler("{\"secoes\":[{\"uid\":\"com espaço\",\"titulo\":\"" + "t".repeat(81) + "\",\"perguntas\":"
                + "[{\"id\":\"ok\",\"tipo\":\"NUMERO\",\"casas\":3,\"unidade\":\"" + "u".repeat(13) + "\"}]}]}");
        assertThat(validator.validate(c)).extracting(v -> v.getPropertyPath().toString()).anyMatch(p -> p.contains("uid"))
                .anyMatch(p -> p.contains("titulo")).anyMatch(p -> p.contains("casas")).anyMatch(p -> p.contains("unidade"));
    }

    @Test
    void listasForaDoLimiteSaoRecusadas() {
        String instrucoes = "\"a\",".repeat(LimitesQuestionario.INSTRUCOES + 1);
        var c = ler("{\"instrucoes\":[" + instrucoes.substring(0, instrucoes.length() - 1) + "],\"secoes\":[]}");
        assertThat(validator.validate(c)).extracting(v -> v.getPropertyPath().toString()).contains("instrucoes");
    }
}
