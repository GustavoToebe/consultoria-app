package br.com.treinos.api.dieta;

import br.com.treinos.api.dieta.ConteudoDieta.Item;
import br.com.treinos.api.dieta.ConteudoDieta.Opcao;
import br.com.treinos.api.dieta.ConteudoDieta.Refeicao;
import br.com.treinos.api.planos.ResultadoValidacao;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

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

        assertThat(original.comItens(i -> i.comDadosDaBiblioteca(BigDecimal.ONE, BigDecimal.ONE, null)).refeicoes().getFirst()
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

    @Test
    void dataDeInicioSegueAFaixaDePlanejamento() {
        LocalDate hoje = LocalDate.of(2026, 11, 3);
        Function<String, ResultadoValidacao> com = data -> validador.validar(
                new ConteudoDieta(null, data, null, List.of(refeicao(null)), List.of(), null, List.of()), null, null, hoje);

        for (String ok : new String[] {null, "", "2000-01-01", "2026-11-03", "2031-12-31"}) {
            assertThat(com.apply(ok).erros()).as("data %s", ok).isEmpty();
        }
        for (String fora : new String[] {"1999-12-31", "2032-01-01", "0260-05-01", "2026-02-31", "amanhã"}) {
            ResultadoValidacao r = com.apply(fora);
            assertThat(caminhosDosErros(r)).as("data %s", fora).containsExactly("dataInicio");
            // A mensagem nomeia o campo e a faixa e nunca repete o valor recebido.
            assertThat(r.erros().getFirst().mensagem()).startsWith("Data de início da dieta:").doesNotContain(fora);
        }
        assertThat(com.apply("2032-01-01").erros().getFirst().mensagem())
                .isEqualTo("Data de início da dieta: use uma data entre 01/01/2000 e 31/12/2031");
    }
}
