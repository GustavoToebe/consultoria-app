package br.com.treinos.api.receitas;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Carga;
import br.com.treinos.api.treino.ConteudoTreino.Esforco;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.treino.ConteudoTreino.Tecnica;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Receitas criadas em toda consultoria nova: ponto de partida genérico, com nomes neutros (nada que
 * identifique outra consultoria). São só estrutura (séries, dias, refeições); nenhuma carga nem alimento é sugerido.
 * As séries seguem a metodologia padrão, pelo código do tipo: FEEDER em % da WS pela regra 50/70/85–90, WORKING na carga
 * de trabalho sem RIR fixo (a metodologia explica: livre 1 RIR, máquina até a falha), BACK_OFF a 85% da WS. Rest pause é
 * técnica da própria série de trabalho, não um tipo. A receita do top set e a pirâmide decrescente têm uids (a referência aponta outra série).
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
        lista.add(series("WS + Top set + 2 Back off", "WS 1x3-6, Top set 1x1-3 (1 a 5% acima da WS) e 2 Back off de 6-8 "
                + "com 15% a menos que o top set.", comTopSet()));
        lista.addAll(doCatalogo());

        lista.add(new Padrao(Receita.Tipo.PLANO_TREINO, "Semana 5 treinos + 2 off ativos",
                "Seg Costas, Ter Peito+Ombros, Qua Pernas, Qui Off ativo, Sex Upper, Sáb Pernas, Dom Off ativo.",
                semana(List.of(
                        sessao("Segunda - Costas", 1, ConteudoTreino.TREINO),
                        sessao("Terça - Peito+Ombros", 2, ConteudoTreino.TREINO),
                        sessao("Quarta - Pernas", 3, ConteudoTreino.TREINO),
                        sessao("Quinta - Off ativo", 4, ConteudoTreino.DESCANSO_ATIVO),
                        sessao("Sexta - Upper", 5, ConteudoTreino.TREINO),
                        sessao("Sábado - Pernas", 6, ConteudoTreino.TREINO),
                        sessao("Domingo - Off ativo", 7, ConteudoTreino.DESCANSO_ATIVO)))));
        lista.add(new Padrao(Receita.Tipo.PLANO_TREINO, "Semana ABC", "Treinos A, B e C em dias alternados.",
                semana(List.of(
                        sessao("Treino A", 1, ConteudoTreino.TREINO),
                        sessao("Treino B", 3, ConteudoTreino.TREINO),
                        sessao("Treino C", 5, ConteudoTreino.TREINO),
                        sessao("Descanso", 7, ConteudoTreino.DESCANSO)))));
        lista.add(new Padrao(Receita.Tipo.PLANO_TREINO, "Semana ABCD", "Treinos A, B, C e D.",
                semana(List.of(
                        sessao("Treino A", 1, ConteudoTreino.TREINO),
                        sessao("Treino B", 2, ConteudoTreino.TREINO),
                        sessao("Treino C", 4, ConteudoTreino.TREINO),
                        sessao("Treino D", 5, ConteudoTreino.TREINO),
                        sessao("Descanso", 7, ConteudoTreino.DESCANSO)))));

        lista.add(new Padrao(Receita.Tipo.PLANO_DIETA, "5 refeições",
                "Café da manhã, lanche, almoço, lanche/ceia e jantar.",
                dieta(List.of("Café da manhã", "Lanche", "Almoço", "Lanche/Ceia", "Jantar"))));
        lista.add(new Padrao(Receita.Tipo.PLANO_DIETA, "3 refeições + 2 lanches",
                "Café da manhã, lanche da manhã, almoço, lanche da tarde e jantar.",
                dieta(List.of("Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar"))));
        return lista;
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

    /**
     * WS, top set e 2 back off: cada back off tira 15% da carga registrada no top set ({@code ABAIXO_DA_REFERENCIA}). É a
     * única receita antiga com uid nas séries, porque a referência aponta uma série; os uids são fixos (nascem do nome)
     * para o JSON da receita ser sempre o mesmo, e o app os troca por uids novos ao aplicar.
     */
    private static List<Serie> comTopSet() {
        UUID topSet = uidFixo("top-set");
        Carga abaixo = Carga.abaixoDa(topSet, 15, null);
        return List.of(
                new Serie(uidFixo("ws"), "WORKING", 3, 6, null, Carga.de(ConteudoTreino.CARGA_TRABALHO), null, null, null,
                        null, null),
                new Serie(topSet, "TOP_SET", 1, 3, null, Carga.percentual(ConteudoTreino.ACIMA_DA_ANTERIOR, 1, 5), null,
                        null, null, null, null),
                new Serie(uidFixo("back-off-1"), "BACK_OFF", 6, 8, null, abaixo, null, null, null, null, null),
                new Serie(uidFixo("back-off-2"), "BACK_OFF", 6, 8, null, abaixo, null, null, null, null, null));
    }

    private static UUID uidFixo(String nome) {
        return UUID.nameUUIDFromBytes(("receita-top-set/" + nome).getBytes(StandardCharsets.UTF_8));
    }

    private static UUID uidDoCatalogo(String nome) {
        return UUID.nameUUIDFromBytes(("receita-catalogo/" + nome).getBytes(StandardCharsets.UTF_8));
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

    /** A 2ª aponta a 1ª e a 3ª aponta a 2ª. Uids fixos porque a referência precisa de um uid estável. */
    private static List<Serie> piramideDecrescente() {
        UUID primeira = uidDoCatalogo("piramide-decrescente-1");
        UUID segunda = uidDoCatalogo("piramide-decrescente-2");
        UUID terceira = uidDoCatalogo("piramide-decrescente-3");
        Tecnica tecnica = Tecnica.vazia(ConteudoTreino.PIRAMIDE_DECRESCENTE);
        return List.of(
                new Serie(primeira, "WORKING", 8, 8, null, Carga.de(ConteudoTreino.CARGA_TRABALHO), null, null, tecnica, null, null),
                new Serie(segunda, "WORKING", 10, 10, null, Carga.abaixoDa(primeira, 10, 15), null, null, tecnica, null, null),
                new Serie(terceira, "WORKING", 12, 12, null, Carga.abaixoDa(segunda, 10, 15), null, null, tecnica, null, null));
    }

    private static List<Serie> piramideTruncada() {
        return List.of(
                comCatalogo("WORKING", 15, 15, null, ConteudoTreino.PIRAMIDE_TRUNCADA),
                comCatalogo("WORKING", 12, 12, null, ConteudoTreino.PIRAMIDE_TRUNCADA).comAlvoExtra("Aumente levemente a carga"),
                comCatalogo("WORKING", 10, 10, null, ConteudoTreino.PIRAMIDE_TRUNCADA).comAlvoExtra("Aumente levemente a carga"));
    }

    private static List<Serie> duplaProgressao() {
        Carga mesma = Carga.de(ConteudoTreino.MESMA_CARGA);
        return List.of(
                comCatalogo("WORKING", 8, 12, Carga.de(ConteudoTreino.CARGA_TRABALHO), ConteudoTreino.DUPLA_PROGRESSAO),
                comCatalogo("WORKING", 8, 12, mesma, ConteudoTreino.DUPLA_PROGRESSAO),
                comCatalogo("WORKING", 8, 12, mesma, ConteudoTreino.DUPLA_PROGRESSAO));
    }

    private static List<Serie> gvt() {
        List<Serie> series = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            Carga carga = i == 0 ? Carga.de(ConteudoTreino.CARGA_TRABALHO) : Carga.de(ConteudoTreino.MESMA_CARGA);
            series.add(comCatalogo("WORKING", 10, 10, carga, ConteudoTreino.GVT).comDescanso(90));
        }
        return series;
    }

    private static List<Serie> fst7() {
        List<Serie> series = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            Carga carga = i == 0 ? Carga.de(ConteudoTreino.CARGA_TRABALHO) : Carga.de(ConteudoTreino.MESMA_CARGA);
            series.add(comCatalogo("WORKING", 10, 12, carga, ConteudoTreino.FST7).comDescanso(30));
        }
        return series;
    }

    private static Carga percentual(int min, Integer max) {
        return Carga.percentual(ConteudoTreino.PERCENTUAL_WS, min, max);
    }

    private static Sessao sessao(String nome, int dia, String tipo) {
        return new Sessao(null, nome, dia, tipo, null, null, null, List.of());
    }

    private static ConteudoTreino semana(List<Sessao> sessoes) {
        return new ConteudoTreino(null, null, sessoes);
    }

    private static ConteudoDieta dieta(List<String> refeicoes) {
        List<ConteudoDieta.Refeicao> lista = refeicoes.stream()
                .map(nome -> new ConteudoDieta.Refeicao(null, nome, null, null,
                        List.of(new ConteudoDieta.Opcao(null, "A", List.of()))))
                .toList();
        return new ConteudoDieta(null, null, null, lista, List.of(), null, List.of());
    }
}
