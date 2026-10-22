package br.com.treinos.api.treino;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Intensidade;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import br.com.treinos.api.web.VideoUrls;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regras de publicação das séries (tipo ou técnica, intensidade em faixa, mesma carga da WS, acima da anterior, RIR),
 * das técnicas (rest pause, cluster, drop-set), da execução (cadência, isometria) e do agrupamento de exercícios.
 */
class ValidadorTreinoTest {

    private static final String BASE = "sessoes[0].exercicios[";
    private static final String SERIE0 = BASE + "0].series[0]";
    private static final Intensidade CARGA = new Intensidade("CARGA_TRABALHO", null, null, null, null);
    private static final Intensidade MESMA_CARGA = new Intensidade("MESMA_CARGA", null, null, null, null);
    private final ValidadorTreino validador = new ValidadorTreino(new VideoUrls(List.of("youtube.com")));

    @Test
    void serieSemTipoSoComTecnica() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(null, 6, 8, null, null))))))
                .contains(SERIE0 + ".tipo");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), serie(null, 6, 8, MESMA_CARGA, restPause(20, null, 1)))))))
                .isEmpty();
    }

    @Test
    void mesmaCargaExigeSerieDeTrabalhoAntesNoExercicio() {
        Serie soTecnica = serie(null, 6, 8, MESMA_CARGA, restPause(20, null, null));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(soTecnica, ws()))))).contains(SERIE0 + ".intensidade.modo");
        // Série de trabalho em outro exercício não conta.
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws()), exercicio(soTecnica)))))
                .contains(BASE + "1].series[0].intensidade.modo");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), soTecnica))))).isEmpty();
    }

    @Test
    void acimaDaAnteriorNaPrimeiraSerieEAviso() {
        Intensidade acima = new Intensidade("ACIMA_DA_ANTERIOR", BigDecimal.ONE, BigDecimal.valueOf(5), null, null);
        ResultadoValidacao r = validador.validar(conteudo(List.of(exercicio(serie("Top set", 3, 5, acima, null)))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anyMatch(a -> a.caminho().equals(SERIE0 + ".intensidade.modo"));
        r = validador.validar(conteudo(List.of(exercicio(ws(), serie("Top set", 3, 5, acima, null)))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith("intensidade.modo"));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), serie("Top set", 3, 5,
                new Intensidade("ACIMA_DA_ANTERIOR", BigDecimal.valueOf(150), null, null, null), null))))))
                .contains(BASE + "0].series[1].intensidade.percentualMin");
    }

    @Test
    void percentualEmFaixaERir() {
        Intensidade faixa = new Intensidade("PERCENTUAL_WS", BigDecimal.valueOf(85), BigDecimal.valueOf(90), null, null);
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("FS", 3, 3, faixa, null), ws()))))).isEmpty();
        Intensidade invertida = new Intensidade("PERCENTUAL_WS", BigDecimal.valueOf(90), BigDecimal.valueOf(85), null, null);
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("FS", 3, 3, invertida, null), ws())))))
                .contains(SERIE0 + ".intensidade.percentualMax");
        Intensidade semMinimo = new Intensidade("PERCENTUAL_WS", null, BigDecimal.valueOf(85), null, null);
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("FS", 3, 3, semMinimo, null), ws())))))
                .contains(SERIE0 + ".intensidade.percentualMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 3, 6,
                new Intensidade("CARGA_TRABALHO", null, null, null, 0), null)))))).isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 3, 6,
                new Intensidade("CARGA_TRABALHO", null, null, null, 6), null)))))).contains(SERIE0 + ".intensidade.rir");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 3, 6,
                new Intensidade("RPE", null, null, new BigDecimal("8.25"), null), null)))))).contains(SERIE0 + ".intensidade.rpe");
        for (String antigo : List.of("RIR", "LIVRE")) {
            assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 3, 6,
                    new Intensidade(antigo, null, null, null, null), null)))))).as(antigo).contains(SERIE0 + ".intensidade.modo");
        }
    }

    @Test
    void clusterTemRepeticoesIguaisASomaDosBlocos() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), serie(null, 6, 6, MESMA_CARGA, cluster(List.of(4, 2), 15)))))))
                .isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), serie(null, 5, 5, MESMA_CARGA, cluster(List.of(4, 2), 15)))))))
                .containsExactly(BASE + "0].series[1].repsMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 4, 4, CARGA, cluster(List.of(0), 15)))))))
                .contains(SERIE0 + ".tecnica.blocos");
        List<Integer> onze = new ArrayList<>();
        for (int i = 0; i < 11; i++) {
            onze.add(1);
        }
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 11, 11, CARGA, cluster(onze, 15)))))))
                .contains(SERIE0 + ".tecnica.blocos");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", null, null, CARGA, cluster(List.of(4, 4), 15)))))))
                .contains(SERIE0 + ".repsMin");
    }

    @Test
    void restPausePedePausaEmSegundosOuRespiracoesEAteCincoPausas() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 6, 8, CARGA, restPause(null, 5, null)))))))
                .isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 6, 8, CARGA, restPause(10, 5, 2)))))))
                .isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 6, 8, CARGA, restPause(null, null, 1)))))))
                .contains(SERIE0 + ".tecnica.pausaSegundos");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 6, 8, CARGA, restPause(20, null, 6)))))))
                .contains(SERIE0 + ".tecnica.pausas");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WS", 6, 8, CARGA, restPause(700, 31, null)))))))
                .contains(SERIE0 + ".tecnica.pausaSegundos", SERIE0 + ".tecnica.pausaRespiracoes");
    }

    @Test
    void dropSetConfereQuedasReducaoERepeticoes() {
        List<String> ruins = caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica("DROP_SET", null, null, null, null, 0, 60, 0))))));
        assertThat(ruins).contains(SERIE0 + ".tecnica.quedas", SERIE0 + ".tecnica.reducaoPercentual",
                SERIE0 + ".tecnica.repsPorQueda");

        // Só as quedas são obrigatórias: sem redução fixada e até a falha. Campos de outra técnica são ignorados.
        List<String> boas = caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica("DROP_SET", 99, null, null, null, 2, null, null))))));
        assertThat(boas).noneMatch(c -> c.contains("tecnica"));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica("DROP_SET", null, null, null, null, 5, 50, 50))))))).noneMatch(c -> c.contains("tecnica"));
    }

    @Test
    void tecnicaDesconhecidaContinuaRecusada() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica("PIRAMIDE", null, null, null, null, null, null, null))))))).contains(SERIE0 + ".tecnica.tipo");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica(null, null, null, null, null, null, null, null))))))).contains(SERIE0 + ".tecnica.tipo");
    }

    @Test
    void cadenciaEmQuatroPartesEIsometriaDeUmACentoEVinte() {
        for (String boa : List.of("3-1-1-0", "2-0-X-1", "X-X-X-X", "")) {
            assertThat(caminhosDeErro(conteudo(List.of(execucao(boa, null))))).as(boa)
                    .doesNotContain(BASE + "0].cadencia");
        }
        for (String ruim : List.of("3-1-1", "3-1-1-0-0", "31-1-0", "3-1-x-0", "3 1 1 0", "a-b-c-d", "10-1-1-0")) {
            assertThat(caminhosDeErro(conteudo(List.of(execucao(ruim, null))))).as(ruim).contains(BASE + "0].cadencia");
        }
        assertThat(caminhosDeErro(conteudo(List.of(execucao(null, 0))))).contains(BASE + "0].isometriaSegundos");
        assertThat(caminhosDeErro(conteudo(List.of(execucao(null, 121))))).contains(BASE + "0].isometriaSegundos");
        assertThat(caminhosDeErro(conteudo(List.of(execucao(null, 10))))).doesNotContain(BASE + "0].isometriaSegundos");
    }

    @Test
    void primeiroExercicioDaSessaoNaoFicaJuntoComAnterior() {
        List<String> erros = caminhosDeErro(conteudo(List.of(junto(true, null), junto(true, null))));
        assertThat(erros).contains(BASE + "0].juntoComAnterior").doesNotContain(BASE + "1].juntoComAnterior");
    }

    @Test
    void grupoVaiAteSeisExercicios() {
        List<ExercicioPlano> seis = new ArrayList<>(List.of(junto(false, null)));
        for (int i = 0; i < 5; i++) {
            seis.add(junto(true, null));
        }
        assertThat(caminhosDeErro(conteudo(seis))).noneMatch(c -> c.endsWith("juntoComAnterior"));

        List<ExercicioPlano> sete = new ArrayList<>(seis);
        sete.add(junto(true, null));
        // Um exercício solto depois recomeça a contagem.
        sete.add(junto(false, null));
        sete.add(junto(true, null));
        assertThat(caminhosDeErro(conteudo(sete)).stream().filter(c -> c.endsWith("juntoComAnterior")))
                .containsExactly(BASE + "6].juntoComAnterior");
    }

    @Test
    void nomeDoGrupoSoAceitaSuperserie() {
        assertThat(caminhosDeErro(conteudo(List.of(junto(false, "SUPERSERIE"), junto(true, null)))))
                .noneMatch(c -> c.endsWith("combinacao"));
        // Fora do primeiro de um grupo de 2 é ignorado, sem erro.
        assertThat(caminhosDeErro(conteudo(List.of(junto(false, null), junto(true, "SUPERSERIE")))))
                .noneMatch(c -> c.endsWith("combinacao"));
        assertThat(caminhosDeErro(conteudo(List.of(junto(false, "TRISET"), junto(true, null)))))
                .contains(BASE + "0].combinacao");
    }

    @Test
    void tipoForaDaMetodologiaEAvisoNaoErro() {
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(exercicio(serieDoTipo("Pirâmide")))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anySatisfy(a -> {
            assertThat(a.caminho()).isEqualTo(SERIE0 + ".tipo");
            assertThat(a.mensagem()).contains("não está na metodologia do plano");
        });
    }

    @Test
    void umAvisoPorTipoDesconhecidoEmCadaExercicio() {
        ExercicioPlano duasPiramides = new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null,
                null, true, "kg", List.of(serieDoTipo("Pirâmide"), serieDoTipo("Pirâmide"), serieDoTipo("Escada")));
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(duasPiramides)), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos().stream().filter(a -> a.caminho().endsWith(".tipo")).map(a -> a.caminho()))
                .containsExactly(SERIE0 + ".tipo", BASE + "0].series[2].tipo");
    }

    @Test
    void semMetodologiaNaoAvisaDoTipoESerieSemTipoTambemNao() {
        ResultadoValidacao r = validador.validar(conteudo(List.of(exercicio(serieDoTipo("Pirâmide")))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith(".tipo"));
        r = validador.validar(conteudoComMetodologia(List.of(exercicio(ws(),
                serie(null, 6, 8, MESMA_CARGA, restPause(20, null, 1))))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith(".tipo"));
    }

    @Test
    void tipoComEspacosNasPontasNaoAvisa() {
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(exercicio(serieDoTipo(" WS ")))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith(".tipo"));
    }

    private List<String> caminhosDeErro(ConteudoTreino conteudo) {
        ResultadoValidacao r = validador.validar(conteudo, null, null);
        return r.erros().stream().map(ResultadoValidacao.Problema::caminho).toList();
    }

    private static Serie serie(String tipo, Integer repsMin, Integer repsMax, Intensidade intensidade, Tecnica tecnica) {
        return new Serie(UUID.randomUUID(), tipo, repsMin, repsMax, intensidade, null, tecnica);
    }

    private static Serie serie(Tecnica tecnica) {
        return serie("WS", 6, 8, CARGA, tecnica);
    }

    private static Serie serieDoTipo(String tipo) {
        return serie(tipo, 6, 8, CARGA, null);
    }

    private static Serie ws() {
        return serie("WS", 3, 6, CARGA, null);
    }

    private static Tecnica restPause(Integer segundos, Integer respiracoes, Integer pausas) {
        return new Tecnica("REST_PAUSE", segundos, respiracoes, pausas, null, null, null, null);
    }

    private static Tecnica cluster(List<Integer> blocos, Integer segundos) {
        return new Tecnica("CLUSTER", segundos, null, null, blocos, null, null, null);
    }

    private static ExercicioPlano exercicio(Serie... series) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null, null, true, "kg",
                List.of(series));
    }

    private static ExercicioPlano execucao(String cadencia, Integer isometria) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Agachamento livre", "LIVRE", null, null, true, "kg",
                List.of(serie(null)), cadencia, isometria, null, null);
    }

    private static ExercicioPlano junto(boolean junto, String combinacao) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Rosca direta", "LIVRE", null, null, true, "kg",
                List.of(serie(null)), null, null, junto, combinacao);
    }

    private static ConteudoTreino conteudo(List<ExercicioPlano> exercicios) {
        return new ConteudoTreino(null, null, List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, exercicios),
                new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of())));
    }

    /** Mesmo conteúdo de {@link #conteudo}, com a metodologia padrão copiada no plano. */
    private static ConteudoTreino conteudoComMetodologia(List<ExercicioPlano> exercicios) {
        return new ConteudoTreino(null, null, List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, exercicios),
                new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of())),
                new ConteudoTreino.Metodologia(null, "M", ConfiguracaoConsultoria.padrao()));
    }
}
