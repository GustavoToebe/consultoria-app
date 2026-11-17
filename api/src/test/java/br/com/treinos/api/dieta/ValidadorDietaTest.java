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

    // ---------------------------------------------------------------- variações por dia da semana

    private static final String ROTULO_SIGILOSO = "Rótulo-fictício-sigiloso";

    private static ConteudoDieta.Variacao variacao(String rotulo, List<Integer> dias, Refeicao... refeicoes) {
        return new ConteudoDieta.Variacao(UUID.randomUUID(), rotulo, dias, List.of(refeicoes));
    }

    private static ConteudoDieta comVariacoes(ConteudoDieta.Variacao... variacoes) {
        return new ConteudoDieta(null, null, null, List.of(), List.of(), null, List.of(), null, null,
                List.of(variacoes));
    }

    private static ConteudoDieta comVariacoesEAguaEErgogenico(ConteudoDieta.Variacao... variacoes) {
        ConteudoDieta.Ergogenico e = new ConteudoDieta.Ergogenico(UUID.randomUUID(), "Item fictício", null, null, null,
                null, null, null);
        return new ConteudoDieta("Objetivo fictício", "2026-11-02", "Profissional fictício", List.of(), List.of(),
                "Obs fictícia", List.of(), List.of(e), new BigDecimal("2.5"), List.of(variacoes));
    }

    private static List<String> mensagensDosErros(ResultadoValidacao r) {
        return r.erros().stream().map(ResultadoValidacao.Problema::mensagem).toList();
    }

    @Test
    void duasVariacoesQueCobremOsSeteDiasPublicamSemErroNemAviso() {
        ConteudoDieta c = comVariacoes(variacao("Carbo alto", List.of(1, 3, 5, 7), refeicao(null)),
                variacao("Carbo zero", List.of(2, 4, 6), refeicao(null)));
        ResultadoValidacao r = validador.validar(c, null, null);
        assertThat(r.erros()).isEmpty();
        // O mesmo nome de refeição em variações diferentes não é repetição: o aviso vale por lista.
        assertThat(r.avisos()).isEmpty();
    }

    @Test
    void rotuloSemDiaSemRefeicaoERaizJuntaSaoErrosComMensagemFixa() {
        ConteudoDieta c = new ConteudoDieta(null, null, null, List.of(refeicao(null)), List.of(), null, List.of(), null,
                null, List.of(variacao(" ", List.of(1, 2, 3, 4, 5, 6, 7), refeicao(null)),
                variacao(ROTULO_SIGILOSO, List.of()), variacao("Outra", null, refeicao(null))));
        ResultadoValidacao r = validador.validar(c, null, null);
        assertThat(caminhosDosErros(r)).containsExactly("refeicoes", "variacoes[0].rotulo", "variacoes[1].dias",
                "variacoes[1].refeicoes", "variacoes[2].dias");
        assertThat(mensagensDosErros(r)).doesNotContain(ROTULO_SIGILOSO).allSatisfy(m -> assertThat(m)
                .doesNotContain(ROTULO_SIGILOSO));
    }

    @Test
    void rotuloComMaisDe40CaracteresEErro() {
        ResultadoValidacao r = validador.validar(comVariacoes(
                variacao("x".repeat(41), List.of(1, 2, 3, 4, 5, 6, 7), refeicao(null))), null, null);
        assertThat(caminhosDosErros(r)).containsExactly("variacoes[0].rotulo");
        assertThat(mensagensDosErros(r).getFirst()).doesNotContain("xxx");
    }

    @Test
    void diaForaDe1A7OuRepetidoEErroEAMensagemSoTemONomeDoDia() {
        // Repetido na mesma variação (1,1) e entre variações (5): só os nomes dos dias na mensagem.
        ConteudoDieta repetido = comVariacoes(variacao(ROTULO_SIGILOSO, List.of(1, 1, 2, 3, 4, 5), refeicao(null)),
                variacao("B", List.of(5, 6, 7), refeicao(null)));
        ResultadoValidacao r = validador.validar(repetido, null, null);
        assertThat(caminhosDosErros(r)).containsExactly("variacoes[0].dias", "variacoes[1].dias");
        assertThat(mensagensDosErros(r)).containsExactly(
                "Dia em mais de uma variação ou repetido: segunda.",
                "Dia em mais de uma variação ou repetido: sexta.");

        ResultadoValidacao fora = validador.validar(comVariacoes(
                variacao("A", List.of(0, 8, 1, 2, 3, 4, 5, 6, 7), refeicao(null))), null, null);
        assertThat(caminhosDosErros(fora)).containsExactly("variacoes[0].dias");
        assertThat(mensagensDosErros(fora)).containsExactly("Dia precisa ser de 1 (segunda) a 7 (domingo).");

    }

    @Test
    void diaDescobertoPublicaComAvisoConfirmavelESemErro() {
        // Dia de descanso: raro e permitido. Só aviso, com os nomes dos dias, nunca o rótulo.
        ResultadoValidacao descoberto = validador.validar(comVariacoes(
                variacao(ROTULO_SIGILOSO, List.of(1, 2, 3, 4, 5), refeicao(null))), null, null);
        assertThat(descoberto.erros()).isEmpty();
        assertThat(descoberto.avisos().stream().map(ResultadoValidacao.Problema::caminho)).containsExactly("variacoes");
        assertThat(descoberto.avisos().stream().map(ResultadoValidacao.Problema::mensagem)).containsExactly(
                "Dia sem dieta marcada: sábado, domingo.");

        // Os sete dias cobertos: nenhum aviso de dia.
        assertThat(validador.validar(comVariacoes(
                variacao("A", List.of(1, 2, 3, 4, 5, 6, 7), refeicao(null))), null, null).avisos()).isEmpty();
    }

    @Test
    void uidRepetidoEntreVariacoesEErroEZeroKcalEAvisoPorVariacao() {
        UUID repetido = UUID.randomUUID();
        Refeicao a = new Refeicao(repetido, "Almoço", null, null,
                List.of(new Opcao(UUID.randomUUID(), "A", List.of(item()))));
        Refeicao b = new Refeicao(repetido, "Almoço", null, null, List.of(new Opcao(UUID.randomUUID(), "A", List.of(
                new Item(UUID.randomUUID(), null, "Água de coco", new BigDecimal("100"), "ml", null, null, null, null,
                        false)))));
        ResultadoValidacao r = validador.validar(comVariacoes(variacao("A", List.of(1, 2, 3), a),
                variacao("B", List.of(4, 5, 6, 7), b)), null, null);
        assertThat(caminhosDosErros(r)).containsExactly("variacoes[1].refeicoes[0].uid");
        assertThat(r.avisos().stream().map(ResultadoValidacao.Problema::caminho)).containsExactly(
                "variacoes[1].refeicoes");
    }

    @Test
    void semVariacaoRaizVazia_aMensagemDeAntesContinua() {
        ResultadoValidacao r = validador.validar(ConteudoDieta.vazio(), null, null);
        assertThat(caminhosDosErros(r)).containsExactly("refeicoes");
        assertThat(mensagensDosErros(r)).containsExactly("A dieta não tem nenhuma refeição.");
    }

    @Test
    void todasAsCopiasDoConteudoLevamAsVariacoes() {
        // O guarda mais barato contra a perda silenciosa: quem reconstrói o record e esquece variacoes cai aqui.
        ConteudoDieta original = comVariacoesEAguaEErgogenico(
                variacao("Carbo alto", List.of(1, 3, 5, 7), refeicao("Misture")),
                variacao("Carbo zero", List.of(2, 4, 6), refeicao(null)));

        assertThat(original.semErgogenicos().variacoes()).isEqualTo(original.variacoes());
        assertThat(original.comErgogenicos(null).variacoes()).isEqualTo(original.variacoes());
        assertThat(original.comErgogenicos(List.of()).variacoes()).isEqualTo(original.variacoes());
        assertThat(original.comDataInicio("2026-12-07").variacoes()).isEqualTo(original.variacoes());
        assertThat(original.comDataInicio("2026-12-07").aguaLitros()).isEqualByComparingTo("2.5");

        ConteudoDieta comItens = original.comItens(i -> i.comDadosDaBiblioteca(BigDecimal.ONE, BigDecimal.TEN, "Grupo"));
        assertThat(comItens.variacoes()).hasSize(2);
        assertThat(comItens.variacoes().get(0).uid()).isEqualTo(original.variacoes().get(0).uid());
        assertThat(comItens.variacoes().get(1).refeicoes().getFirst().opcoes().getFirst().itens().getFirst().grupo())
                .isEqualTo("Grupo");
        assertThat(comItens.variacoes().getFirst().refeicoes().getFirst().modoDePreparo()).isEqualTo("Misture");

        ConteudoDieta nova = original.comUidsNovos();
        assertThat(nova.variacoes()).hasSize(2);
        for (int i = 0; i < 2; i++) {
            ConteudoDieta.Variacao antes = original.variacoes().get(i);
            ConteudoDieta.Variacao depois = nova.variacoes().get(i);
            assertThat(depois.uid()).isNotEqualTo(antes.uid());
            assertThat(depois.rotulo()).isEqualTo(antes.rotulo());
            assertThat(depois.dias()).isEqualTo(antes.dias());
            assertThat(depois.refeicoes().getFirst().uid()).isNotEqualTo(antes.refeicoes().getFirst().uid());
            assertThat(depois.refeicoes().getFirst().opcoes().getFirst().itens().getFirst().uid())
                    .isNotEqualTo(antes.refeicoes().getFirst().opcoes().getFirst().itens().getFirst().uid());
        }
        assertThat(nova.todasAsRefeicoes()).hasSize(2);
        assertThat(original.todasAsRefeicoes()).hasSize(2);
        // Os campos globais da raiz continuam iguais nas variações de cópia.
        assertThat(nova.observacoes()).isEqualTo("Obs fictícia");
        assertThat(nova.aguaLitros()).isEqualByComparingTo("2.5");
    }

    @Test
    void jsonDasVariacoesIdaEVoltaESemOCampoFicaListaVazia() {
        JsonMapper json = JsonMapper.builder().build();
        ConteudoDieta original = comVariacoes(variacao("Carbo alto", List.of(1, 2, 3, 4, 5, 6, 7), refeicao(null)));
        ConteudoDieta lido = json.readValue(json.writeValueAsString(original), ConteudoDieta.class);
        assertThat(lido.variacoes()).hasSize(1);
        assertThat(lido.variacoes().getFirst().rotulo()).isEqualTo("Carbo alto");
        assertThat(lido.variacoes().getFirst().dias()).containsExactly(1, 2, 3, 4, 5, 6, 7);
        assertThat(lido.refeicoes()).isEmpty();

        // Versão publicada antes do campo (ou corpo sem ele) lê como "sem variação", não como nulo.
        assertThat(json.readValue("{\"refeicoes\":[]}", ConteudoDieta.class).variacoes()).isEmpty();
        assertThat(json.readValue("{\"refeicoes\":[],\"variacoes\":null}", ConteudoDieta.class).variacoes()).isEmpty();
        assertThat(ConteudoDieta.vazio().variacoes()).isEmpty();
    }
}
