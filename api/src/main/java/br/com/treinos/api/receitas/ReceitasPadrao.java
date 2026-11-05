package br.com.treinos.api.receitas;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Esforco;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;

import java.util.ArrayList;
import java.util.List;

/**
 * Receitas criadas em toda consultoria nova (inclusive o catálogo de séries e os dois exemplos com Cluster): ponto de
 * partida genérico, com nomes neutros (nada que identifique outra consultoria). São só estrutura (séries, dias, refeições); nenhuma carga nem alimento é sugerido.
 * As séries seguem a metodologia padrão, pelo código do tipo: FEEDER em % da WS pela regra 50/70/85–90, WORKING na carga
 * de trabalho, BACK_OFF a 85% da WS. Rest pause é
 * técnica da própria série de trabalho, não um tipo. As seis primeiras receitas de série são as combinações reais dos
 * planos do Saraiva (esforço RIR 0 nas séries de trabalho e de back off); as séries não levam uid: nascem no app ao aplicar.
 */
public final class ReceitasPadrao {

    public record Padrao(Receita.Tipo tipo, String nome, String descricao, Object conteudo) {
    }

    private ReceitasPadrao() {
    }

    public static List<Padrao> todas() {
        List<Padrao> lista = new ArrayList<>();
        lista.add(new Padrao(Receita.Tipo.METODOLOGIA, "Metodologia da consultoria", "Regras de série dos planos novos.",
                ConfiguracaoConsultoria.padrao()));
        lista.addAll(completas());
        lista.add(series("Aquecimento + 3 FS + WS + 2 Back off 85%",
                "Aquecimento 1x10-15, FS 3x3 (50/70/85 a 90%), WS 1x3-6, Back off 2x6-8 (85%).",
                junta(List.of(aquecimento()), fs3(), List.of(ws()), backOff(2))));
        lista.add(series("3 FS + WS + 2 Back off 85%", "FS 3x3 (50/70/85 a 90%), WS 1x3-6, Back off 2x6-8 (85%).",
                junta(fs3(), List.of(ws()), backOff(2))));
        lista.add(series("2 FS + WS + 2 Back off 85%", "FS 2x3 (70/85 a 90%), WS 1x3-6, Back off 2x6-8 (85%).",
                junta(fs2(), List.of(ws()), backOff(2))));
        lista.add(series("2 FS + 2 WS", "FS 2x3 (70/85 a 90%), WS 2x3-6, sem back off.",
                junta(fs2(), List.of(ws(), ws()))));
        lista.add(series("1 FS + 2 WS", "FS 1x3-5 (85%), WS 2x3-6.",
                List.of(serie("FEEDER", 3, 5, percentual(85, null)), ws(), ws())));
        lista.add(series("Séries simples 3x8-12", "Sem FS: 3 séries de trabalho de 8 a 12, 2 RIR.",
                List.of(simples(), simples(), simples())));
        lista.add(series("WS + Rest pause", "WS 1x3-6 com rest pause de 20 s, na própria série.",
                List.of(ws().comTecnica(Tecnica.restPause(20, null, 1)))));
        lista.addAll(doCatalogo());
        lista.addAll(exemplos());

        lista.add(new Padrao(Receita.Tipo.PLANO_DIETA, "5 refeições",
                "Café da manhã, lanche, almoço, lanche/ceia e jantar.",
                dieta(List.of("Café da manhã", "Lanche", "Almoço", "Lanche/Ceia", "Jantar"))));
        lista.add(new Padrao(Receita.Tipo.PLANO_DIETA, "3 refeições + 2 lanches",
                "Café da manhã, lanche da manhã, almoço, lanche da tarde e jantar.",
                dieta(List.of("Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar"))));
        return lista;
    }

    /** As seis receitas completas dos planos reais (preparação, trabalho e, depois, top set, back off ou técnica). */
    private static List<Padrao> completas() {
        return List.of(
                series("3 FS + WS + Rest pause",
                        "FS 3x3-5 (50/70/85 a 90%), WS 1x3-6 e WS 1x6-8 com rest pause (1 pausa de 20 s), RIR 0.",
                        junta(fs3a5(), List.of(wsAteFalha(3, 6), wsAteFalha(6, 8).comTecnica(Tecnica.restPause(20, null, 1))))),
                series("3 FS + WS + 2 Back off", "FS 3x3-5 (50/70/85 a 90%), WS 1x3-6 e Back off 2x6-8 (85% da WS), RIR 0.",
                        junta(fs3a5(), List.of(wsAteFalha(3, 6)), backOffAteFalha(2))),
                series("3 FS + WS + Cluster",
                        "FS 3x3-5 (50/70/85 a 90%), WS 1x6-8 e WS 1x12 com Cluster (4 blocos de 3, pausa de 15 s), RIR 0.",
                        junta(fs3a5(), List.of(wsAteFalha(6, 8), wsClusterAteFalha()))),
                series("3 FS + Cluster",
                        "FS 3x3-5 (50/70/85 a 90%) e WS 1x12 com Cluster (4 blocos de 3, pausa de 15 s), RIR 0.",
                        junta(fs3a5(), List.of(wsClusterAteFalha()))),
                series("2 FS + WS + Back off", "FS 2x3-5 (70/85 a 90%), WS 1x3-6 e Back off 1x6-8 (85% da WS), RIR 0.",
                        junta(fs2a5(), List.of(wsAteFalha(3, 6)), backOffAteFalha(1))),
                series("2 FS + WS + Top set + Back off",
                        "2 FS em rampa (50% e 75% da WS) + 1 WS pesada + 1 Top set (6 a 8, carga acima da WS) + 1 Back off a 80% da WS.",
                        List.of(serie("FEEDER", 3, 5, percentual(50, null)), serie("FEEDER", 3, 5, percentual(75, null)),
                                wsAteFalha(8, 8),
                                serie("TOP_SET", 6, 8, Carga.de(ConteudoTreino.CARGA_TRABALHO)).comEsforco(Esforco.deRir(0)),
                                serie("BACK_OFF", 8, 12, percentual(80, null)).comEsforco(Esforco.deRir(0)))));
    }

    private static List<Serie> fs3a5() {
        return List.of(serie("FEEDER", 3, 5, percentual(50, null)), serie("FEEDER", 3, 5, percentual(70, null)),
                serie("FEEDER", 3, 5, percentual(85, 90)));
    }

    private static List<Serie> fs2a5() {
        return List.of(serie("FEEDER", 3, 5, percentual(70, null)), serie("FEEDER", 3, 5, percentual(85, 90)));
    }

    private static Serie wsAteFalha(int min, int max) {
        return serie("WORKING", min, max, Carga.de(ConteudoTreino.CARGA_TRABALHO)).comEsforco(Esforco.deRir(0));
    }

    /** Cluster de 4 blocos de 3 com pausa de 15 s: as repetições são a soma dos blocos (12). */
    private static Serie wsClusterAteFalha() {
        return wsAteFalha(12, 12).comTecnica(Tecnica.cluster(List.of(3, 3, 3, 3), 15, null));
    }

    private static List<Serie> backOffAteFalha(int quantidade) {
        return backOff(quantidade).stream().map(x -> x.comEsforco(Esforco.deRir(0))).toList();
    }

    private static Padrao series(String nome, String descricao, List<Serie> series) {
        return new Padrao(Receita.Tipo.SERIES, nome, descricao, new ReceitaSeries(series));
    }

    @SafeVarargs
    private static List<Serie> junta(List<Serie>... partes) {
        List<Serie> todas = new ArrayList<>();
        for (List<Serie> parte : partes) {
            todas.addAll(parte);
        }
        return todas;
    }

    private static Serie serie(String tipo, Integer repsMin, Integer repsMax, Carga carga) {
        return Serie.de(null, tipo, repsMin, repsMax, carga);
    }

    private static Serie aquecimento() {
        return serie("WARM_UP", 10, 15, null);
    }

    /** 3 FS pela regra da metodologia padrão: 50%, 70% e 85 a 90% da WS. */
    private static List<Serie> fs3() {
        return List.of(serie("FEEDER", 3, 3, percentual(50, null)), serie("FEEDER", 3, 3, percentual(70, null)),
                serie("FEEDER", 3, 3, percentual(85, 90)));
    }

    /** 2 FS: 70% e 85 a 90% da WS. */
    private static List<Serie> fs2() {
        return List.of(serie("FEEDER", 3, 3, percentual(70, null)), serie("FEEDER", 3, 3, percentual(85, 90)));
    }

    private static Serie ws() {
        return serie("WORKING", 3, 6, Carga.de(ConteudoTreino.CARGA_TRABALHO));
    }

    private static List<Serie> backOff(int quantidade) {
        List<Serie> series = new ArrayList<>();
        for (int i = 0; i < quantidade; i++) {
            series.add(serie("BACK_OFF", 6, 8, percentual(85, null)));
        }
        return series;
    }

    private static Serie simples() {
        return serie("WORKING", 8, 12, Carga.de(ConteudoTreino.CARGA_TRABALHO)).comEsforco(Esforco.deRir(2));
    }

    /** Nomes das seis receitas de série do catálogo. A V026 grava só estas nas consultorias que já existem. */
    public static final List<String> NOMES_DO_CATALOGO = List.of("Pirâmide crescente", "Pirâmide decrescente",
            "Pirâmide truncada", "Dupla progressão", "GVT 10×10", "FST-7");

    /** As seis receitas de série do catálogo, na ordem dos nomes. */
    public static List<Padrao> doCatalogo() {
        return List.of(
                series("Pirâmide crescente", "A cada série a carga sobe e as repetições diminuem.", piramideCrescente()),
                series("Pirâmide decrescente",
                        "Comece pela série mais pesada (depois do aquecimento) e, a cada série, reduza a carga e faça mais repetições.",
                        piramideDecrescente()),
                series("Pirâmide truncada", "Só a parte que sobe: a carga aumenta aos poucos a cada série, sem descer depois.",
                        piramideTruncada()),
                series("Dupla progressão", "Trabalhe dentro da faixa de repetições.", duplaProgressao()),
                series("GVT 10×10", "10 séries de 10 repetições com a mesma carga e o mesmo descanso entre as séries.", gvt()),
                series("FST-7", "No fim do treino do músculo, 7 séries do mesmo exercício com descanso curto entre elas.", fst7()));
    }

    /** Nomes das duas receitas de exemplo (FS, WS e Cluster). A V034 grava só estas nas consultorias que já existem. */
    public static final List<String> NOMES_DOS_EXEMPLOS = List.of("Exemplo: FS, WS e Cluster", "Exemplo: FS e Cluster");

    /** As duas receitas de exemplo, na ordem dos nomes. Só estrutura: sem esforço nem descanso. */
    public static List<Padrao> exemplos() {
        return List.of(
                series("Exemplo: FS, WS e Cluster", "FS 1x10-15, WS 1x6-8 e WS com Cluster 4×4, pausa de 15 s.",
                        List.of(fsDoExemplo(), wsDoExemplo(), wsComClusterDoExemplo())),
                series("Exemplo: FS e Cluster", "FS 1x10-15 e WS com Cluster 4×4, pausa de 15 s.",
                        List.of(fsDoExemplo(), wsComClusterDoExemplo())));
    }

    /** FS de 10 a 15 repetições, na carga em % da WS que a metodologia padrão dá à FS sozinha (85%). */
    private static Serie fsDoExemplo() {
        return serie("FEEDER", 10, 15, percentual(85, null));
    }

    private static Serie wsDoExemplo() {
        return serie("WORKING", 6, 8, Carga.de(ConteudoTreino.CARGA_TRABALHO));
    }

    /** Cluster de 4 blocos de 4, pausa de 15 s: as repetições são a soma dos blocos (16). */
    private static Serie wsComClusterDoExemplo() {
        return serie("WORKING", 16, 16, Carga.de(ConteudoTreino.CARGA_TRABALHO))
                .comTecnica(Tecnica.cluster(List.of(4, 4, 4, 4), 15, null));
    }

    private static Serie comCatalogo(String tipo, Integer min, Integer max, Carga carga, String tecnica) {
        return serie(tipo, min, max, carga).comTecnica(Tecnica.vazia(tecnica));
    }

    private static List<Serie> piramideCrescente() {
        return List.of(
                comCatalogo("WORKING", 12, 12, null, ConteudoTreino.PIRAMIDE_CRESCENTE).comAlvoExtra("Carga leve"),
                comCatalogo("WORKING", 10, 10, null, ConteudoTreino.PIRAMIDE_CRESCENTE).comAlvoExtra("Carga moderada"),
                comCatalogo("WORKING", 8, 8, null, ConteudoTreino.PIRAMIDE_CRESCENTE).comAlvoExtra("Carga pesada"));
    }

    /** A 1ª na carga de trabalho; as seguintes em 85% da WS. */
    private static List<Serie> piramideDecrescente() {
        Tecnica tecnica = Tecnica.vazia(ConteudoTreino.PIRAMIDE_DECRESCENTE);
        return List.of(
                serie("WORKING", 8, 8, Carga.de(ConteudoTreino.CARGA_TRABALHO)).comTecnica(tecnica),
                serie("WORKING", 10, 10, percentual(85, null)).comTecnica(tecnica),
                serie("WORKING", 12, 12, percentual(85, null)).comTecnica(tecnica));
    }

    private static List<Serie> piramideTruncada() {
        return List.of(
                comCatalogo("WORKING", 15, 15, null, ConteudoTreino.PIRAMIDE_TRUNCADA),
                comCatalogo("WORKING", 12, 12, null, ConteudoTreino.PIRAMIDE_TRUNCADA).comAlvoExtra("Aumente levemente a carga"),
                comCatalogo("WORKING", 10, 10, null, ConteudoTreino.PIRAMIDE_TRUNCADA).comAlvoExtra("Aumente levemente a carga"));
    }

    private static List<Serie> duplaProgressao() {
        Carga mesma = Carga.de(ConteudoTreino.CARGA_TRABALHO);
        return List.of(
                comCatalogo("WORKING", 8, 12, Carga.de(ConteudoTreino.CARGA_TRABALHO), ConteudoTreino.DUPLA_PROGRESSAO),
                comCatalogo("WORKING", 8, 12, mesma, ConteudoTreino.DUPLA_PROGRESSAO),
                comCatalogo("WORKING", 8, 12, mesma, ConteudoTreino.DUPLA_PROGRESSAO));
    }

    private static List<Serie> gvt() {
        List<Serie> series = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            Carga carga = Carga.de(ConteudoTreino.CARGA_TRABALHO);
            series.add(comCatalogo("WORKING", 10, 10, carga, ConteudoTreino.GVT).comDescanso(90));
        }
        return series;
    }

    private static List<Serie> fst7() {
        List<Serie> series = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            Carga carga = Carga.de(ConteudoTreino.CARGA_TRABALHO);
            series.add(comCatalogo("WORKING", 10, 12, carga, ConteudoTreino.FST7).comDescanso(30));
        }
        return series;
    }

    private static Carga percentual(int min, Integer max) {
        return Carga.percentual(ConteudoTreino.PERCENTUAL_WS, min, max);
    }

    private static ConteudoDieta dieta(List<String> refeicoes) {
        List<ConteudoDieta.Refeicao> lista = refeicoes.stream()
                .map(nome -> new ConteudoDieta.Refeicao(null, nome, null, null,
                        List.of(new ConteudoDieta.Opcao(null, "A", List.of()))))
                .toList();
        return new ConteudoDieta(null, null, null, lista, List.of(), null, List.of());
    }
}
