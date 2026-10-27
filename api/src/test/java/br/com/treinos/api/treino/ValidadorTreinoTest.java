package br.com.treinos.api.treino;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.planos.ResultadoValidacao;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.CargaDaEtapa;
import br.com.treinos.api.treino.ConteudoTreino.Cardio;
import br.com.treinos.api.treino.ConteudoTreino.Esforco;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Grupo;
import br.com.treinos.api.treino.ConteudoTreino.Retomada;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;
import br.com.treinos.api.web.VideoUrls;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regras de publicação das séries (tipo obrigatório, repetições, AMRAP, carga, esforço, cardio), das técnicas, da
 * execução (cadência, isometria) e dos grupos de exercícios (superset, circuito, pré e pós-exaustão).
 */
class ValidadorTreinoTest {

    private static final String BASE = "sessoes[0].exercicios[";
    private static final String SERIE0 = BASE + "0].series[0]";
    private static final String GRUPO0 = "sessoes[0].grupos[0]";
    private final ValidadorTreino validador = new ValidadorTreino(new VideoUrls(List.of("youtube.com")));

    // ---- Tipo, repetições e AMRAP ----

    @Test
    void serieSemTipoEErroEATecnicaNaoSubstituiOTipo() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(null, 6, 8, CARGA, null))))))
                .contains(SERIE0 + ".tipo");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("  ", 6, 8, CARGA, null)))))).contains(SERIE0 + ".tipo");
        // Rest pause sem tipo: a técnica entra na série de trabalho, não a substitui.
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), serie(null, 6, 8, MESMA, restPause(20, null, 1)))))))
                .containsExactly(BASE + "0].series[1].tipo");
        assertThat(mensagemDeErro(conteudo(List.of(exercicio(serie(null, 6, 8, CARGA, null)))), SERIE0 + ".tipo"))
                .isEqualTo("Série sem tipo.");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comTecnica(restPause(20, null, 1))))))).isEmpty();
    }

    @Test
    void repeticoesMinimaEMaximaJuntasEMinimoNaoMaiorQueOMaximo() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 8, 6, CARGA, null))))))
                .contains(SERIE0 + ".repsMax");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 8, null, CARGA, null))))))
                .contains(SERIE0 + ".repsMax");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", -1, 6, CARGA, null))))))
                .contains(SERIE0 + ".repsMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 6, 501, CARGA, null))))))
                .contains(SERIE0 + ".repsMin");
        // Sem repetições nenhuma: série por tempo, válida.
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", null, null, CARGA, null)))))).isEmpty();
    }

    @Test
    void amrapExcluiRepeticoes() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", null, null, CARGA, null).comAmrap(true))))))
                .isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 6, 8, CARGA, null).comAmrap(true))))))
                .contains(SERIE0 + ".amrap");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 6, null, CARGA, null).comAmrap(true))))))
                .contains(SERIE0 + ".amrap");
        // amrap falso é o mesmo que ausente.
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 6, 8, CARGA, null).comAmrap(false))))))
                .isEmpty();
    }

    @Test
    void descansoEAlvoExtraTemLimite() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comDescanso(3601)))))).contains(SERIE0 + ".descansoSegundos");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comDescanso(-1)))))).contains(SERIE0 + ".descansoSegundos");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comDescanso(0)))))).isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comAlvoExtra("x".repeat(120))))))).isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comAlvoExtra("x".repeat(121))))))).contains(SERIE0 + ".alvoExtra");
    }

    // ---- Carga ----

    @Test
    void mesmaCargaExigeSerieDeTrabalhoAntesNoExercicio() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(mesma(), ws()))))).contains(SERIE0 + ".carga.modo");
        // Série de trabalho em outro exercício não conta.
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws()), exercicio(mesma())))))
                .contains(BASE + "1].series[0].carga.modo");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), mesma()))))).isEmpty();
    }

    @Test
    void acimaDaAnteriorNaPrimeiraSerieEAviso() {
        Carga acima = Carga.percentual("ACIMA_DA_ANTERIOR", 1, 5);
        ResultadoValidacao r = validador.validar(conteudo(List.of(exercicio(serie("TOP_SET", 3, 5, acima, null)))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anyMatch(a -> a.caminho().equals(SERIE0 + ".carga.modo"));
        r = validador.validar(conteudo(List.of(exercicio(ws(), serie("TOP_SET", 3, 5, acima, null)))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith("carga.modo"));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), serie("TOP_SET", 3, 5,
                Carga.percentual("ACIMA_DA_ANTERIOR", 101, null), null))))))
                .contains(BASE + "0].series[1].carga.percentualMin");
    }

    @Test
    void percentualDaWsEmFaixaEFormaDeCargaInvalida() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("FEEDER", 3, 3, Carga.percentual("PERCENTUAL_WS", 85, 90), null),
                ws()))))).isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("FEEDER", 3, 3, Carga.percentual("PERCENTUAL_WS", 90, 85), null),
                ws()))))).contains(SERIE0 + ".carga.percentualMax");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("FEEDER", 3, 3,
                new Carga("PERCENTUAL_WS", null, BigDecimal.valueOf(85), null), null), ws()))))).contains(SERIE0 + ".carga.percentualMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("FEEDER", 3, 3, Carga.percentual("PERCENTUAL_WS", 201, null), null),
                ws()))))).contains(SERIE0 + ".carga.percentualMin");
        for (String antigo : List.of("RIR", "RPE", "LIVRE")) {
            assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 3, 6, Carga.de(antigo), null))))))
                    .as(antigo).contains(SERIE0 + ".carga.modo");
        }
    }

    @Test
    void percentualSemNenhumaSerieDeTrabalhoNoExercicioEAviso() {
        Serie fs = serie("FEEDER", 3, 3, Carga.percentual("PERCENTUAL_WS", 85, null), null);
        ResultadoValidacao r = validador.validar(conteudo(List.of(exercicio(fs))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anyMatch(a -> a.caminho().equals(BASE + "0].series") && a.mensagem().contains("% da WS"));
        r = validador.validar(conteudo(List.of(exercicio(fs, ws()))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.mensagem().contains("% da WS"));
    }

    @Test
    void abaixoDaReferenciaPrecisaDeSerieAnteriorDoMesmoExercicio() {
        Serie topSet = serie("TOP_SET", 1, 3, Carga.percentual("ACIMA_DA_ANTERIOR", 1, 5), null);
        Serie backOff = serie("BACK_OFF", 6, 8, Carga.abaixoDa(topSet.uid(), 15, null), null);
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), topSet, backOff))))).isEmpty();
        // Série de referência depois do back off, ou em outro exercício, ou que não existe: erro.
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), backOff, topSet)))))
                .contains(BASE + "0].series[1].carga.referenciaUid");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), topSet), exercicio(ws(), backOff)))))
                .contains(BASE + "1].series[1].carga.referenciaUid");
        Serie solta = serie("BACK_OFF", 6, 8, Carga.abaixoDa(UUID.randomUUID(), 15, null), null);
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), solta))))).contains(BASE + "0].series[1].carga.referenciaUid");
        // Sem referência, ou com redução fora de 1 a 50.
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), serie("BACK_OFF", 6, 8,
                Carga.percentual("ABAIXO_DA_REFERENCIA", 15, null), null))))))
                .contains(BASE + "0].series[1].carga.referenciaUid");
        Serie exagero = serie("BACK_OFF", 6, 8, Carga.abaixoDa(topSet.uid(), 51, null), null);
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), topSet, exagero)))))
                .contains(BASE + "0].series[2].carga.percentualMin");
        // A referência é qualquer série anterior, não só a de trabalho.
        Serie aWs = ws();
        Serie sobreWs = serie("BACK_OFF", 6, 8, Carga.abaixoDa(aWs.uid(), 10, 15), null);
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(aWs, sobreWs))))).isEmpty();
    }

    // ---- Esforço ----

    @Test
    void esforcoRirDeZeroACincoRpeDeMeioEmMeioNuncaOsDois() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(Esforco.deRir(0))))))).isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(Esforco.deRir(5))))))).isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(Esforco.deRir(6)))))))
                .contains(SERIE0 + ".esforco.rir");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(Esforco.deRir(-1)))))))
                .contains(SERIE0 + ".esforco.rir");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(Esforco.deRpe("8.5"))))))).isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(Esforco.deRpe("8.25")))))))
                .contains(SERIE0 + ".esforco.rpe");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(Esforco.deRpe("0.5")))))))
                .contains(SERIE0 + ".esforco.rpe");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(Esforco.deRpe("10.5")))))))
                .contains(SERIE0 + ".esforco.rpe");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(new Esforco(1, new BigDecimal("8"))))))))
                .contains(SERIE0 + ".esforco.rpe");
        // Esforço vazio é o mesmo que nenhum.
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws().comEsforco(new Esforco(null, null))))))).isEmpty();
        // WS em RPE continua sendo série de trabalho: o que decide é a carga, não o esforço.
        assertThat(ws().comEsforco(Esforco.deRpe("8")).deTrabalho()).isTrue();
    }

    @Test
    void rirZeroEmAquecimentoOuPreparacaoEAvisoPelaMetodologiaDoPlano() {
        Serie aquecimento = serie("WARM_UP", 10, 15, null, null).comEsforco(Esforco.deRir(0));
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(exercicio(aquecimento, ws()))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anyMatch(a -> a.caminho().equals(SERIE0 + ".esforco.rir"));
        Serie fs = serie("FEEDER", 3, 3, Carga.percentual("PERCENTUAL_WS", 85, null), null).comEsforco(Esforco.deRir(0));
        r = validador.validar(conteudoComMetodologia(List.of(exercicio(fs, ws()))), null, null);
        assertThat(r.avisos()).anyMatch(a -> a.caminho().equals(SERIE0 + ".esforco.rir"));
        // RIR 0 na série de trabalho é o normal; RIR 1 no aquecimento não incomoda; sem metodologia o papel é desconhecido.
        r = validador.validar(conteudoComMetodologia(List.of(exercicio(ws().comEsforco(Esforco.deRir(0))))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith("esforco.rir"));
        r = validador.validar(conteudoComMetodologia(List.of(exercicio(
                serie("WARM_UP", 10, 15, null, null).comEsforco(Esforco.deRir(1)), ws()))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith("esforco.rir"));
        r = validador.validar(conteudo(List.of(exercicio(aquecimento, ws()))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith("esforco.rir"));
    }

    // ---- Técnicas ----

    @Test
    void clusterTemRepeticoesIguaisASomaDosBlocos() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), serie("WORKING", 6, 6, CARGA, cluster(List.of(4, 2), 15)))))))
                .isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(ws(), serie("WORKING", 5, 5, CARGA, cluster(List.of(4, 2), 15)))))))
                .containsExactly(BASE + "0].series[1].repsMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 4, 4, CARGA, cluster(List.of(0), 15)))))))
                .contains(SERIE0 + ".tecnica.blocos");
        List<Integer> onze = new ArrayList<>();
        for (int i = 0; i < 11; i++) {
            onze.add(1);
        }
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 11, 11, CARGA, cluster(onze, 15)))))))
                .contains(SERIE0 + ".tecnica.blocos");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", null, null, CARGA, cluster(List.of(4, 4), 15)))))))
                .contains(SERIE0 + ".repsMin");
    }

    @Test
    void restPausePedePausaEmSegundosOuRespiracoesEAteCincoPausas() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 6, 8, CARGA, restPause(null, 5, null)))))))
                .isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 6, 8, CARGA, restPause(10, 5, 2)))))))
                .isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 6, 8, CARGA, restPause(null, null, 1)))))))
                .contains(SERIE0 + ".tecnica.pausaSegundos");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 6, 8, CARGA, restPause(20, null, 6)))))))
                .contains(SERIE0 + ".tecnica.pausas");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie("WORKING", 6, 8, CARGA, restPause(700, 31, null)))))))
                .contains(SERIE0 + ".tecnica.pausaSegundos", SERIE0 + ".tecnica.pausaRespiracoes");
    }

    @Test
    void dropSetConfereQuedasReducaoRepeticoesEAceitaPausaZero() {
        List<String> ruins = caminhosDeErro(conteudo(List.of(exercicio(serie(
                Tecnica.dropSet(0, 60, 0, -1))))));
        assertThat(ruins).contains(SERIE0 + ".tecnica.quedas", SERIE0 + ".tecnica.reducaoPercentual",
                SERIE0 + ".tecnica.repsPorQueda", SERIE0 + ".tecnica.pausaSegundos");

        // Só as quedas são obrigatórias: sem redução fixada e até a falha. Campos de outra técnica são ignorados.
        List<String> boas = caminhosDeErro(conteudo(List.of(exercicio(serie(
                new Tecnica("DROP_SET", null, 99, null, null, 2, null, null, null, null, null, null, null, null, null))))));
        assertThat(boas).noneMatch(c -> c.contains("tecnica"));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.dropSet(5, 50, 50, null)))))))
                .noneMatch(c -> c.contains("tecnica"));
        // Sem pausa entre as quedas (0 s) é válido; acima de 600 s não.
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.dropSet(2, null, null, 0)))))))
                .noneMatch(c -> c.contains("tecnica"));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.dropSet(2, null, null, 601)))))))
                .contains(SERIE0 + ".tecnica.pausaSegundos");
    }

    @Test
    void myoRepsConfereMiniSeriesRepeticoesEPausa() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.myoReps(5, 3, null, 5)))))))
                .noneMatch(c -> c.contains("tecnica"));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.myoReps(4, 5, 10, null)))))))
                .noneMatch(c -> c.contains("tecnica"));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.myoReps(1, 51, null, null)))))))
                .contains(SERIE0 + ".tecnica.miniSeries", SERIE0 + ".tecnica.repsPorMiniSerie", SERIE0 + ".tecnica.pausaSegundos");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.myoReps(11, 3, 10, null)))))))
                .contains(SERIE0 + ".tecnica.miniSeries");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.myoReps(null, null, 10, null)))))))
                .contains(SERIE0 + ".tecnica.miniSeries", SERIE0 + ".tecnica.repsPorMiniSerie");
    }

    @Test
    void partialRepsConfereRepeticoesEARegiao() {
        for (String regiao : ConteudoTreino.REGIOES) {
            assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.partialReps(5, regiao)))))))
                    .as(regiao).noneMatch(c -> c.contains("tecnica"));
        }
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.partialReps(31, "NO_MEIO")))))))
                .contains(SERIE0 + ".tecnica.repsParciais", SERIE0 + ".tecnica.regiao");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.partialReps(0, null)))))))
                .contains(SERIE0 + ".tecnica.repsParciais", SERIE0 + ".tecnica.regiao");
    }

    @Test
    void forcedRepsConfereAssistidasEAvisaDoParceiro() {
        ResultadoValidacao r = validador.validar(conteudo(List.of(exercicio(serie(Tecnica.forcedReps(2))))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anySatisfy(a -> {
            assertThat(a.caminho()).isEqualTo(SERIE0 + ".tecnica");
            assertThat(a.mensagem()).contains("parceiro");
        });
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.forcedReps(6)))))))
                .contains(SERIE0 + ".tecnica.repsAssistidas");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.forcedReps(null)))))))
                .contains(SERIE0 + ".tecnica.repsAssistidas");
        // As outras técnicas não avisam de parceiro.
        r = validador.validar(conteudo(List.of(exercicio(serie(restPause(20, null, 1))))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.mensagem().contains("parceiro"));
    }

    @Test
    void tecnicaDesconhecidaContinuaRecusada() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.vazia("PIRAMIDE")))))))
                .contains(SERIE0 + ".tecnica.tipo");
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.vazia(null)))))))
                .contains(SERIE0 + ".tecnica.tipo");
    }

    // ---- Cardio ----

    @Test
    void exercicioDeCardioPedeCardioEProibeTipoCargaEsforcoRepeticoesETecnica() {
        Serie boa = cardio(new Cardio(30, null, "leve", 2, null));
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(boa))))).isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(
                cardio(new Cardio(null, null, null, null, new Cardio.Intervalos(30, 60, 8)))))))).isEmpty();
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(
                cardio(new Cardio(null, new BigDecimal("5.5"), "6:00/km", null, null))))))).isEmpty();

        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(serie(null, null, null, null, null))))))
                .containsExactly(BASE + "0].series[0].cardio");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(boa.comTipo("WORKING"))))))
                .containsExactly(SERIE0 + ".tipo");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(boa.comCarga(Carga.de("CARGA_TRABALHO")))))))
                .containsExactly(SERIE0 + ".carga");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(boa.comEsforco(Esforco.deRir(1)))))))
                .containsExactly(SERIE0 + ".esforco");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(boa.comReps(10, 12))))))
                .containsExactly(SERIE0 + ".repsMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(boa.comAmrap(true))))))
                .containsExactly(SERIE0 + ".repsMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(boa.comTecnica(restPause(20, null, 1)))))))
                .containsExactly(SERIE0 + ".tecnica");
        // Carga NENHUMA e esforço vazio são o mesmo que nada.
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(boa.comCarga(Carga.de("NENHUMA"))
                .comEsforco(new Esforco(null, null))))))).isEmpty();
    }

    @Test
    void cardioConfereDuracaoDistanciaZonaEIntervalos() {
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(cardio(new Cardio(null, null, null, null, null)))))))
                .contains(SERIE0 + ".cardio.duracaoMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(cardio(new Cardio(0, null, null, null, null)))))))
                .contains(SERIE0 + ".cardio.duracaoMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(cardio(new Cardio(601, null, null, null, null)))))))
                .contains(SERIE0 + ".cardio.duracaoMin");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(cardio(new Cardio(30, BigDecimal.ZERO, null, 6, null)))))))
                .contains(SERIE0 + ".cardio.distanciaKm", SERIE0 + ".cardio.zona");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(cardio(new Cardio(30, null, "x".repeat(41), 0, null)))))))
                .contains(SERIE0 + ".cardio.ritmo", SERIE0 + ".cardio.zona");
        assertThat(caminhosDeErro(conteudo(List.of(exercicioDeCardio(
                cardio(new Cardio(null, null, null, null, new Cardio.Intervalos(null, 3601, 0))))))))
                .contains(SERIE0 + ".cardio.intervalos.trabalhoSeg", SERIE0 + ".cardio.intervalos.descansoSeg",
                        SERIE0 + ".cardio.intervalos.voltas");
    }

    @Test
    void cardioForaDeExercicioDeCardioEErro() {
        Serie comCardio = ws().comCardio(new Cardio(30, null, null, null, null));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(comCardio))))).containsExactly(SERIE0 + ".cardio");
    }

    @Test
    void cardioNaoPedeTipoNemAvisaDeMetodologia() {
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(exercicioDeCardio(
                cardio(new Cardio(30, null, null, null, null))))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith(".tipo"));
    }

    // ---- Execução ----

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

    // ---- Grupos ----

    @Test
    void supersetEAgonistaAntagonistaPedemPeloMenosDois() {
        for (String tecnica : List.of("SUPERSET", "AGONISTA_ANTAGONISTA")) {
            Grupo g = grupo(tecnica, null, null);
            assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(g), noGrupo(g)), List.of(g)))).as(tecnica).isEmpty();
            assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(g)), List.of(g)))).as(tecnica).contains(GRUPO0);
        }
    }

    @Test
    void triSetGiantSetECircuitoPedemTresQuatroETres() {
        Grupo tri = grupo("TRI_SET", null, null);
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(tri), noGrupo(tri)), List.of(tri)))).contains(GRUPO0);
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(tri), noGrupo(tri), noGrupo(tri)), List.of(tri)))).isEmpty();
        Grupo giant = grupo("GIANT_SET", null, null);
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(giant), noGrupo(giant), noGrupo(giant)), List.of(giant))))
                .contains(GRUPO0);
        assertThat(caminhosDeErro(conteudoComGrupos(
                List.of(noGrupo(giant), noGrupo(giant), noGrupo(giant), noGrupo(giant)), List.of(giant)))).isEmpty();
        Grupo circuito = grupo("CIRCUITO", 60, 3);
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(circuito), noGrupo(circuito)), List.of(circuito))))
                .contains(GRUPO0);
        assertThat(caminhosDeErro(conteudoComGrupos(
                List.of(noGrupo(circuito), noGrupo(circuito), noGrupo(circuito)), List.of(circuito)))).isEmpty();
    }

    @Test
    void circuitoPedeVoltasDeUmAVinteEOutrosGruposIgnoramVoltas() {
        for (Integer voltas : new Integer[] {null, 0, 21}) {
            Grupo c = grupo("CIRCUITO", 60, voltas);
            assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(c), noGrupo(c), noGrupo(c)), List.of(c))))
                    .as("voltas " + voltas).containsExactly(GRUPO0 + ".voltas");
        }
        Grupo superset = grupo("SUPERSET", 60, 99);
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(superset), noGrupo(superset)), List.of(superset)))).isEmpty();
    }

    @Test
    void circuitoComVoltasDiferentesDasSeriesDeUmMembroSoAvisa() {
        Grupo c = grupo("CIRCUITO", 60, 3);
        ResultadoValidacao r = validador.validar(conteudoComGrupos(List.of(noGrupo(c), noGrupo(c), noGrupo(c)), List.of(c)),
                null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anyMatch(a -> a.caminho().equals(GRUPO0 + ".voltas") && a.mensagem().contains("3 séries")
                && a.mensagem().contains("Rosca direta tem 1"));
        Grupo umaVolta = grupo("CIRCUITO", 60, 1);
        ResultadoValidacao certo = validador.validar(conteudoComGrupos(
                List.of(noGrupo(umaVolta), noGrupo(umaVolta), noGrupo(umaVolta)), List.of(umaVolta)), null, null);
        assertThat(certo.avisos()).noneMatch(a -> a.caminho().startsWith(GRUPO0));
    }

    @Test
    void preEPosExaustaoTemExatamenteDoisExerciciosESemDescansoDoGrupo() {
        for (String tecnica : List.of("PRE_EXAUSTAO", "POS_EXAUSTAO")) {
            Grupo g = grupo(tecnica, null, null);
            assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(g), noGrupo(g)), List.of(g)))).as(tecnica).isEmpty();
            assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(g)), List.of(g)))).as(tecnica).contains(GRUPO0);
            assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(g), noGrupo(g), noGrupo(g)), List.of(g))))
                    .as(tecnica).contains(GRUPO0);
            Grupo comDescanso = grupo(tecnica, 60, null);
            assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(comDescanso), noGrupo(comDescanso)),
                    List.of(comDescanso)))).as(tecnica).containsExactly(GRUPO0 + ".descansoAposSegundos");
        }
    }

    @Test
    void descansoDepoisDoGrupoDeZeroATresMilESeiscentos() {
        for (int descanso : new int[] {0, 90, 3600}) {
            Grupo g = grupo("SUPERSET", descanso, null);
            assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(g), noGrupo(g)), List.of(g)))).as("" + descanso).isEmpty();
        }
        for (int descanso : new int[] {-1, 3601}) {
            Grupo g = grupo("SUPERSET", descanso, null);
            assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(g), noGrupo(g)), List.of(g))))
                    .as("" + descanso).containsExactly(GRUPO0 + ".descansoAposSegundos");
        }
    }

    @Test
    void membrosDoGrupoPrecisamSerContiguos() {
        Grupo g = grupo("TRI_SET", null, null);
        List<ExercicioPlano> separados = List.of(noGrupo(g), solto(), noGrupo(g), noGrupo(g));
        assertThat(caminhosDeErro(conteudoComGrupos(separados, List.of(g)))).containsExactly(GRUPO0);
        List<ExercicioPlano> juntos = List.of(solto(), noGrupo(g), noGrupo(g), noGrupo(g), solto());
        assertThat(caminhosDeErro(conteudoComGrupos(juntos, List.of(g)))).isEmpty();
    }

    @Test
    void doisGruposNaMesmaSessaoCadaUmComSeusMembros() {
        Grupo a = grupo("SUPERSET", 60, null);
        Grupo b = grupo("PRE_EXAUSTAO", null, null);
        List<ExercicioPlano> exercicios = List.of(noGrupo(a), noGrupo(a), noGrupo(b), noGrupo(b));
        assertThat(caminhosDeErro(conteudoComGrupos(exercicios, List.of(a, b)))).isEmpty();
    }

    @Test
    void grupoVaiAteSeisExercicios() {
        Grupo g = grupo("GIANT_SET", null, null);
        List<ExercicioPlano> seis = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            seis.add(noGrupo(g));
        }
        assertThat(caminhosDeErro(conteudoComGrupos(seis, List.of(g)))).isEmpty();
        List<ExercicioPlano> sete = new ArrayList<>(seis);
        sete.add(noGrupo(g));
        assertThat(caminhosDeErro(conteudoComGrupos(sete, List.of(g)))).containsExactly(GRUPO0);
    }

    @Test
    void grupoUidPrecisaExistirEGrupoSemMembrosEErro() {
        Grupo g = grupo("SUPERSET", null, null);
        ExercicioPlano orfao = new ExercicioPlano(UUID.randomUUID(), null, "Rosca direta", "LIVRE", null, null, true, "kg",
                List.of(ws()), null, null, UUID.randomUUID());
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(orfao), List.of())))
                .containsExactly(BASE + "0].grupoUid");
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(solto()), List.of(g)))).containsExactly(GRUPO0);
    }

    @Test
    void tecnicaDeGrupoInvalidaEUidDeGrupoRepetidoOuAusente() {
        Grupo invalido = grupo("SUPERSERIE", null, null);
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(invalido), noGrupo(invalido)), List.of(invalido))))
                .contains(GRUPO0 + ".tecnica");
        Grupo semTecnica = grupo(null, null, null);
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(semTecnica)), List.of(semTecnica))))
                .contains(GRUPO0 + ".tecnica");
        Grupo semUid = new Grupo(null, "SUPERSET", null, null);
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(solto()), List.of(semUid)))).contains(GRUPO0 + ".uid");
        Grupo g = grupo("SUPERSET", null, null);
        Grupo igual = new Grupo(g.uid(), "SUPERSET", null, null);
        assertThat(caminhosDeErro(conteudoComGrupos(List.of(noGrupo(g), noGrupo(g)), List.of(g, igual))))
                .contains("sessoes[0].grupos[1].uid");
    }

    // ---- Metodologia do plano ----

    @Test
    void tipoForaDaMetodologiaEAvisoNaoErro() {
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(exercicio(serieDoTipo("PIRAMIDE")))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anySatisfy(a -> {
            assertThat(a.caminho()).isEqualTo(SERIE0 + ".tipo");
            assertThat(a.mensagem()).contains("não está na metodologia do plano");
        });
    }

    @Test
    void umAvisoPorTipoDesconhecidoEmCadaExercicio() {
        ExercicioPlano duasPiramides = new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null,
                null, true, "kg", List.of(serieDoTipo("PIRAMIDE"), serieDoTipo("PIRAMIDE"), serieDoTipo("ESCADA")));
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(duasPiramides)), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos().stream().filter(a -> a.caminho().endsWith(".tipo")).map(a -> a.caminho()))
                .containsExactly(SERIE0 + ".tipo", BASE + "0].series[2].tipo");
    }

    @Test
    void tecnicaForaDaMetodologiaEAvisoNaoErro() {
        Serie negativa = serie(Tecnica.vazia(ConteudoTreino.NEGATIVA));
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(exercicio(negativa))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anySatisfy(a -> {
            assertThat(a.caminho()).isEqualTo(SERIE0 + ".tecnica");
            assertThat(a.mensagem()).contains("não está na metodologia do plano");
        });
    }

    @Test
    void semMetodologiaNaoAvisaDaTecnica() {
        ResultadoValidacao r = validador.validar(conteudo(List.of(exercicio(serie(Tecnica.vazia(ConteudoTreino.GVT))))), null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).noneMatch(a -> a.mensagem().contains("não está na metodologia"));
    }

    @Test
    void combinacaoForaDaMetodologiaEAvisoNaoErro() {
        ConfiguracaoConsultoria semCombinacao = new ConfiguracaoConsultoria(ConfiguracaoConsultoria.padrao().tipos(),
                ConfiguracaoConsultoria.padrao().tecnicas(), List.of(), ConfiguracaoConsultoria.padrao().arredondamentoKg(),
                "", "");
        Grupo g = grupo("SUPERSET", 60, null);
        ConteudoTreino conteudo = conteudoComGrupos(List.of(noGrupo(g), noGrupo(g)), List.of(g))
                .comMetodologia(new ConteudoTreino.Metodologia(null, "M", semCombinacao));
        ResultadoValidacao r = validador.validar(conteudo, null, null);
        assertThat(r.erros()).isEmpty();
        assertThat(r.avisos()).anySatisfy(a -> {
            assertThat(a.caminho()).isEqualTo(GRUPO0 + ".tecnica");
            assertThat(a.mensagem()).contains("não está na metodologia do plano");
        });
    }

    @Test
    void cadaTecnicaDescritivaPublicaSemErro() {
        for (String tipo : ConteudoTreino.DESCRITIVAS) {
            Tecnica cheia = new Tecnica(tipo, 20, 5, 2, List.of(4, 2), 2, 20, 8, 3, 5, 4, "LIVRE", 2, null, null);
            assertThat(cheia.problemas()).as(tipo).isEmpty();
            assertThat(caminhosDeErro(conteudo(List.of(exercicio(serie(Tecnica.vazia(tipo))))))).as(tipo).isEmpty();
        }
    }

    @Test
    void semMetodologiaNaoAvisaDoTipo() {
        ResultadoValidacao r = validador.validar(conteudo(List.of(exercicio(serieDoTipo("PIRAMIDE")))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith(".tipo"));
    }

    @Test
    void codigoDoTipoComEspacosNasPontasNaoAvisa() {
        ResultadoValidacao r = validador.validar(conteudoComMetodologia(List.of(exercicio(serieDoTipo(" WORKING ")))), null, null);
        assertThat(r.avisos()).noneMatch(a -> a.caminho().endsWith(".tipo"));
    }

    @Test
    void problemasDaSerieSaoReusadosPelasReceitasDeSeries() {
        assertThat(ValidadorTreino.problemasDaSerie(ws(), false)).isEmpty();
        assertThat(ValidadorTreino.problemasDaSerie(serie(null, 6, 8, CARGA, null), false)).containsKey("tipo");
        assertThat(ValidadorTreino.problemasDaSerie(ws().comEsforco(Esforco.deRir(9)), false)).containsKey("esforco.rir");
        assertThat(ValidadorTreino.problemasDaSerie(cardio(new Cardio(20, null, null, null, null)), true)).isEmpty();
        assertThat(ValidadorTreino.problemasDaSerie(ws(), true)).containsKey("cardio");
        Map<String, String> p = ValidadorTreino.problemasDaSerie(serie("WORKING", 8, 6, CARGA, null), false);
        assertThat(p).containsOnlyKeys("repsMax");
    }

    // ---- Carga por bloco e retomadas (docs/series-etapas.md, lote C) ----

    private static final CargaDaEtapa DA_SERIE = new CargaDaEtapa("DA_SERIE", null);

    private static CargaDaEtapa pct(Integer p) {
        return new CargaDaEtapa("PERCENTUAL_WS", p);
    }

    @Test
    void cargaPorBlocoUmaParaCadaBlocoComPercentualDe1A200() {
        Serie boa = serie("WORKING", 10, 10, CARGA, cluster(List.of(4, 4, 2), 15)
                .comCargasDosBlocos(List.of(DA_SERIE, pct(90), pct(80))));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(boa))))).isEmpty();

        Serie curta = serie("WORKING", 10, 10, CARGA, cluster(List.of(4, 4, 2), 15).comCargasDosBlocos(List.of(DA_SERIE, pct(90))));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(curta))))).containsExactly(SERIE0 + ".tecnica.cargasDosBlocos");

        Serie semPercentual = serie("WORKING", 8, 8, CARGA, cluster(List.of(4, 4), 15).comCargasDosBlocos(List.of(DA_SERIE, pct(null))));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(semPercentual)))))
                .containsExactly(SERIE0 + ".tecnica.cargasDosBlocos[1].percentual");
        assertThat(mensagemDeErro(conteudo(List.of(exercicio(semPercentual))), SERIE0 + ".tecnica.cargasDosBlocos[1].percentual"))
                .isEqualTo("Bloco 2: Percentual da WS entre 1 e 200.");

        Serie foraDaFaixa = serie("WORKING", 8, 8, CARGA, cluster(List.of(4, 4), 15).comCargasDosBlocos(List.of(pct(0), pct(201))));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(foraDaFaixa))))).containsExactly(
                SERIE0 + ".tecnica.cargasDosBlocos[0].percentual", SERIE0 + ".tecnica.cargasDosBlocos[1].percentual");

        Serie modoErrado = serie("WORKING", 8, 8, CARGA, cluster(List.of(4, 4), 15)
                .comCargasDosBlocos(List.of(new CargaDaEtapa("ACIMA_DA_ANTERIOR", 5), new CargaDaEtapa("DA_SERIE", 90))));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(modoErrado))))).containsExactly(
                SERIE0 + ".tecnica.cargasDosBlocos[0].modo", SERIE0 + ".tecnica.cargasDosBlocos[1].percentual");
    }

    @Test
    void retomadasUmaPorPausaComMetaEscolhidaECargaObrigatoria() {
        Serie boa = serie("WORKING", 6, 8, CARGA, restPause(20, null, 2)
                .comRetomadas(List.of(new Retomada(2, 3, null, DA_SERIE), new Retomada(null, null, true, pct(90)))));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(boa))))).isEmpty();
        // Sem pausas informadas vale uma.
        Serie umaPausa = serie("WORKING", 6, 8, CARGA, restPause(20, null, null).comRetomadas(List.of(new Retomada(2, 2, null, DA_SERIE))));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(umaPausa))))).isEmpty();

        Serie aMais = serie("WORKING", 6, 8, CARGA, restPause(20, null, 1)
                .comRetomadas(List.of(new Retomada(2, 2, null, DA_SERIE), new Retomada(2, 2, null, DA_SERIE))));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(aMais))))).containsExactly(SERIE0 + ".tecnica.retomadas");

        Serie problemas = serie("WORKING", 6, 8, CARGA, restPause(20, null, 3).comRetomadas(List.of(
                new Retomada(null, null, null, DA_SERIE),
                new Retomada(3, 2, null, null),
                new Retomada(2, 2, true, pct(250)))));
        assertThat(caminhosDeErro(conteudo(List.of(exercicio(problemas))))).containsExactlyInAnyOrder(
                SERIE0 + ".tecnica.retomadas[0].repsMin",
                SERIE0 + ".tecnica.retomadas[1].repsMax",
                SERIE0 + ".tecnica.retomadas[1].carga",
                SERIE0 + ".tecnica.retomadas[2].amrap",
                SERIE0 + ".tecnica.retomadas[2].carga.percentual");
        assertThat(mensagemDeErro(conteudo(List.of(exercicio(problemas))), SERIE0 + ".tecnica.retomadas[0].repsMin"))
                .isEqualTo("Retomada 1: Informe as repetições (exatas ou faixa) ou AMRAP.");
    }

    @Test
    void exercicioSemCargaNaoTemCargaPorBlocoNemRetomadaEmPercentual() {
        ExercicioPlano barra = new ExercicioPlano(UUID.randomUUID(), null, "Barra fixa", "LIVRE", null, null, true, "nenhuma",
                List.of(serie("WORKING", 8, 8, null, cluster(List.of(4, 4), 15).comCargasDosBlocos(List.of(DA_SERIE, DA_SERIE))),
                        serie("WORKING", 6, 8, null, restPause(20, null, 1).comRetomadas(List.of(new Retomada(2, 2, null, pct(90))))),
                        serie("WORKING", 6, 8, null, restPause(20, null, 1).comRetomadas(List.of(new Retomada(2, 2, null, DA_SERIE))))));
        assertThat(caminhosDeErro(conteudo(List.of(barra)))).containsExactly(
                BASE + "0].series[0].tecnica.cargasDosBlocos", BASE + "0].series[1].tecnica.retomadas");
    }

    @Test
    void cargaPorBlocoERetomadasNaoEntramNoPadraoDaMetodologia() {
        assertThat(cluster(List.of(4, 4), 15).comCargasDosBlocos(List.of(DA_SERIE, pct(90))).problemasDosValores())
                .containsKey("cargasDosBlocos");
        assertThat(restPause(20, null, 1).comRetomadas(List.of(new Retomada(2, 2, null, DA_SERIE))).problemasDosValores())
                .containsKey("retomadas");
        // Campos de outra técnica são ignorados.
        assertThat(Tecnica.dropSet(1, null, null, null).comCargasDosBlocos(List.of(pct(500))).problemas()).isEmpty();
    }

    // ---- Apoio ----

    private List<String> caminhosDeErro(ConteudoTreino conteudo) {
        ResultadoValidacao r = validador.validar(conteudo, null, null);
        return r.erros().stream().map(ResultadoValidacao.Problema::caminho).toList();
    }

    private String mensagemDeErro(ConteudoTreino conteudo, String caminho) {
        return validador.validar(conteudo, null, null).erros().stream().filter(e -> e.caminho().equals(caminho))
                .map(ResultadoValidacao.Problema::mensagem).findFirst().orElseThrow();
    }

    private static final Carga CARGA = Carga.de("CARGA_TRABALHO");
    private static final Carga MESMA = Carga.de("MESMA_CARGA");

    private static Serie serie(String tipo, Integer repsMin, Integer repsMax, Carga carga, Tecnica tecnica) {
        return Serie.de(UUID.randomUUID(), tipo, repsMin, repsMax, carga).comTecnica(tecnica);
    }

    private static Serie serie(Tecnica tecnica) {
        return serie("WORKING", 6, 8, CARGA, tecnica);
    }

    private static Serie serieDoTipo(String tipo) {
        return serie(tipo, 6, 8, CARGA, null);
    }

    private static Serie ws() {
        return serie("WORKING", 3, 6, CARGA, null);
    }

    private static Serie mesma() {
        return serie("WORKING", 6, 8, MESMA, null);
    }

    private static Serie cardio(Cardio cardio) {
        return serie(null, null, null, null, null).comCardio(cardio);
    }

    private static Tecnica restPause(Integer segundos, Integer respiracoes, Integer pausas) {
        return Tecnica.restPause(segundos, respiracoes, pausas);
    }

    private static Tecnica cluster(List<Integer> blocos, Integer segundos) {
        return Tecnica.cluster(blocos, segundos, null);
    }

    private static ExercicioPlano exercicio(Serie... series) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Supino reto com barra", "LIVRE", null, null, true, "kg",
                List.of(series));
    }

    private static ExercicioPlano exercicioDeCardio(Serie... series) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Esteira", "CARDIO", null, null, null, "nenhuma",
                List.of(series));
    }

    private static ExercicioPlano execucao(String cadencia, Integer isometria) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Agachamento livre", "LIVRE", null, null, true, "kg",
                List.of(ws()), cadencia, isometria, null);
    }

    private static Grupo grupo(String tecnica, Integer descansoApos, Integer voltas) {
        return new Grupo(UUID.randomUUID(), tecnica, descansoApos, voltas);
    }

    private static ExercicioPlano noGrupo(Grupo g) {
        return new ExercicioPlano(UUID.randomUUID(), null, "Rosca direta", "LIVRE", null, null, true, "kg",
                List.of(ws()), null, null, g.uid());
    }

    private static ExercicioPlano solto() {
        return exercicio(ws());
    }

    private static ConteudoTreino conteudo(List<ExercicioPlano> exercicios) {
        return conteudoComGrupos(exercicios, null);
    }

    private static ConteudoTreino conteudoComGrupos(List<ExercicioPlano> exercicios, List<Grupo> grupos) {
        return new ConteudoTreino(null, null, List.of(
                new Sessao(UUID.randomUUID(), "Treino A", 1, "TREINO", null, null, null, exercicios, grupos),
                new Sessao(UUID.randomUUID(), "Descanso", 7, "DESCANSO", null, null, null, List.of())));
    }

    /** Mesmo conteúdo de {@link #conteudo}, com a metodologia padrão copiada no plano. */
    private static ConteudoTreino conteudoComMetodologia(List<ExercicioPlano> exercicios) {
        return conteudo(exercicios).comMetodologia(new ConteudoTreino.Metodologia(null, "M", ConfiguracaoConsultoria.padrao()));
    }
}
