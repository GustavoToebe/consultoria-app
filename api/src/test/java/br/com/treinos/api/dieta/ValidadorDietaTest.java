package br.com.treinos.api.dieta;

import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import br.com.treinos.api.planos.ResultadoValidacao;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Modo de preparo da refeição (28/10): opcional, até 2000 caracteres, com as quebras de linha preservadas; as cópias do
 * conteúdo (uids novos, troca de itens, sem ergogênicos) e o JSON levam o campo junto. Sem Docker.
 */
class ValidadorDietaTest {

    private final ValidadorDieta validador = new ValidadorDieta();

    private static Item item() {
        return new Item(UUID.randomUUID(), null, "Arroz fictício", new BigDecimal("100"), "g", new BigDecimal("130"),
                BigDecimal.ONE, BigDecimal.TEN, BigDecimal.ZERO, true);
    }

    private static Refeicao refeicao(String modoDePreparo) {
        return new Refeicao(UUID.randomUUID(), "Almoço", "12:00", null,
                List.of(new Opcao(UUID.randomUUID(), "A", List.of(item()))), modoDePreparo);
    }

    private static ConteudoDieta dieta(Refeicao r) {
        return new ConteudoDieta(null, null, null, List.of(r), List.of(), null, List.of());
    }

    private static List<String> caminhosDosErros(ResultadoValidacao r) {
        return r.erros().stream().map(ResultadoValidacao.Problema::caminho).toList();
    }

    @Test
    void modoDePreparoEOpcionalEAte2000Caracteres() {
        assertThat(validador.validar(dieta(refeicao(null)), null, null).erros()).isEmpty();
        assertThat(validador.validar(dieta(refeicao("")), null, null).erros()).isEmpty();
        assertThat(validador.validar(dieta(refeicao("x".repeat(2000))), null, null).erros()).isEmpty();

        ResultadoValidacao longo = validador.validar(dieta(refeicao("x".repeat(2001))), null, null);
        assertThat(caminhosDosErros(longo)).containsExactly("refeicoes[0].modoDePreparo");
        // A mensagem nunca repete o texto do treinador.
        assertThat(longo.erros().getFirst().mensagem()).isEqualTo("Modo de preparo com até 2000 caracteres.")
                .doesNotContain("xxx");
    }

    @Test
    void copiasDoConteudoLevamOModoDePreparoComAsQuebrasDeLinha() {
        String receita = "Cozinhe o arroz.\nMisture o frango.\n\nSirva quente.";
        ConteudoDieta original = dieta(refeicao(receita));

        ConteudoDieta comUidsNovos = original.comUidsNovos();
        assertThat(comUidsNovos.refeicoes().getFirst().uid()).isNotEqualTo(original.refeicoes().getFirst().uid());
        assertThat(comUidsNovos.refeicoes().getFirst().modoDePreparo()).isEqualTo(receita);

        assertThat(original.comItens(i -> i.comFatores(BigDecimal.ONE, BigDecimal.ONE)).refeicoes().getFirst()
                .modoDePreparo()).isEqualTo(receita);
        assertThat(original.semErgogenicos().refeicoes().getFirst().modoDePreparo()).isEqualTo(receita);
    }

    @Test
    void jsonGuardaEDevolveOModoDePreparoESemEleFicaNulo() {
        JsonMapper json = JsonMapper.builder().build();
        String receita = "Linha 1\nLinha 2";
        String texto = json.writeValueAsString(dieta(refeicao(receita)));
        assertThat(texto).contains("\"modoDePreparo\":\"Linha 1\\nLinha 2\"");
        assertThat(json.readValue(texto, ConteudoDieta.class).refeicoes().getFirst().modoDePreparo()).isEqualTo(receita);

        String semCampo = "{\"refeicoes\":[{\"nome\":\"Almoço\",\"opcoes\":[]}]}";
        assertThat(json.readValue(semCampo, ConteudoDieta.class).refeicoes().getFirst().modoDePreparo()).isNull();
    }
}
