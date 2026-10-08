package br.com.treinos.api.receitas;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.Intensidade;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Receitas criadas em toda consultoria nova (seção 9.6): o Saraiva já entra configurado e outros treinadores têm um
 * ponto de partida. São só estrutura (séries, dias, refeições); nenhuma carga nem alimento é sugerido.
 */
final class ReceitasPadrao {

    record Padrao(Receita.Tipo tipo, String nome, String descricao, Object conteudo) {
    }

    private ReceitasPadrao() {
    }

    static List<Padrao> todas() {
        List<Padrao> lista = new ArrayList<>();
        lista.add(new Padrao(Receita.Tipo.METODOLOGIA, "Metodologia da consultoria", "Regras para novos modelos.",
                br.com.treinos.api.consultoria.ConfiguracaoConsultoria.padrao()));
        lista.add(series("Aquecimento + 3 FS + WS + 2 Back off 85%",
                "Aquecimento 1x10-15, FS 3x3 (50/70/85%), WS 1x3-6, Back off 2x6-8 (85%).",
                junta(List.of(aquecimento()), fs(50, 70, 85), List.of(ws()), backOff(2))));
        lista.add(series("3 FS + WS + 2 Back off 85%", "FS 3x3 (50/70/85%), WS 1x3-6, Back off 2x6-8 (85%).",
                junta(fs(50, 70, 85), List.of(ws()), backOff(2))));
        lista.add(series("2 FS + WS + 2 Back off 85%", "FS 2x3 (70/85%), WS 1x3-6, Back off 2x6-8 (85%).",
                junta(fs(70, 85), List.of(ws()), backOff(2))));
        lista.add(series("2 FS + 2 WS", "FS 2x3 (70/85%), WS 2x3-6, sem back off.",
                junta(fs(70, 85), List.of(ws(), ws()))));
        lista.add(series("1 FS + 2 WS", "FS 1x3-5 (85%), WS 2x3-6.",
                List.of(new Serie(null, "FS", 3, 5, null, percentual(85), null), ws(), ws())));
        lista.add(series("Séries simples 3x8-12", "Para quem não usa FS/WS: 3 séries de 8 a 12, 2 RIR.",
                List.of(simples(), simples(), simples())));
        lista.add(series("Cardio", "Cardio por tempo, sem carga.",
                List.of(new Serie(null, "Cardio", null, null, "50 min ou HIIT 25 min", nenhuma(), null))));

        lista.add(new Padrao(Receita.Tipo.PLANO_TREINO, "Semana Saraiva",
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

    private static Serie aquecimento() {
        return new Serie(null, "Aquecimento", 10, 15, null, nenhuma(), null);
    }

    private static List<Serie> fs(int... percentuais) {
        List<Serie> series = new ArrayList<>();
        for (int p : percentuais) {
            series.add(new Serie(null, "FS", 3, 3, null, percentual(p), null));
        }
        return series;
    }

    private static Serie ws() {
        return new Serie(null, "WS", 3, 6, null, new Intensidade(ConteudoTreino.CARGA_TRABALHO, null, null, null, null),
                null);
    }

    private static List<Serie> backOff(int quantidade) {
        List<Serie> series = new ArrayList<>();
        for (int i = 0; i < quantidade; i++) {
            series.add(new Serie(null, "Back off", 6, 8, null, percentual(85), null));
        }
        return series;
    }

    private static Serie simples() {
        return new Serie(null, "Série", 8, 12, null, new Intensidade("RIR", null, 2, null, null), null);
    }

    private static Intensidade percentual(int valor) {
        return new Intensidade(ConteudoTreino.PERCENTUAL_WS, BigDecimal.valueOf(valor), null, null, null);
    }

    private static Intensidade nenhuma() {
        return new Intensidade("NENHUMA", null, null, null, null);
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
