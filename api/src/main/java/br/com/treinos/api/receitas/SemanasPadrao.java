package br.com.treinos.api.receitas;

import br.com.treinos.api.receitas.Receita.Tipo;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Sessao;
import br.com.treinos.api.web.Buscas;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Semanas, Dias e mobilidades do padrão. As 32 Semanas vêm das 8 divisões. Os Dias saem só da Variação 1,
 * uma sessão de treino por modelo. As 3 mobilidades novas entram; Plano 10, Plano 2.1, Plano 16 e as duas
 * mobilidades de {@code scripts/importacao/dados/} ficam de fora (D-008). Sem coleção.
 * O {@code exercicioId} é resolvido pelo nome na biblioteca da consultoria; sem par, continua nulo.
 */
public final class SemanasPadrao {

    private static final Pattern VARIACAO_1 = Pattern.compile(" - Variação 1( - .*)?$");
    private static final List<String> SEMANAS_ARQUIVOS = List.of(
            "divisao-1-fullbody-4x.json",
            "divisao-2-ppl-ul.json",
            "divisao-3-torso-limbs.json",
            "divisao-4-upper-lower.json",
            "divisao-5-ppl-pp.json",
            "divisao-6-fullbody-5x.json",
            "divisao-7-upper-lower-upper-fullbody.json",
            "divisao-8-ppl-x2.json");

    private static final List<Modelo> SEMANAS = lerSemanas();
    private static final List<Modelo> DIAS = derivarDias();
    private static final List<Modelo> MOBILIDADES = lerMobilidades();

    private SemanasPadrao() {
    }

    public record Modelo(Tipo tipo, String nome, String descricao, Object conteudo) {
    }

    /** Exercício já gravado na biblioteca. O nome e a modalidade da biblioteca vencem os do JSON. */
    public record ExercicioDaBiblioteca(UUID id, String nome, String modalidade) {
    }

    public static List<Modelo> semanas() {
        return SEMANAS;
    }

    public static List<Modelo> dias() {
        return DIAS;
    }

    public static List<Modelo> mobilidades() {
        return MOBILIDADES;
    }

    public static List<Modelo> todos() {
        List<Modelo> todos = new ArrayList<>(SEMANAS.size() + DIAS.size() + MOBILIDADES.size());
        todos.addAll(SEMANAS);
        todos.addAll(DIAS);
        todos.addAll(MOBILIDADES);
        return List.copyOf(todos);
    }

    /** Receitas que uma consultoria nova passa a ter, com as dietas. */
    public static int totalNaConsultoriaNova() {
        return DietasPadrao.totalNaConsultoriaNova() + todos().size();
    }

    /** Troca o exercício cujo nome sem acento existe na biblioteca. Sem par, o item fica como está. */
    public static Modelo comExercicios(Modelo modelo, Map<String, ExercicioDaBiblioteca> porBusca) {
        if (!(modelo.conteudo() instanceof ConteudoTreino treino) || porBusca.isEmpty()) {
            return modelo;
        }
        List<Sessao> sessoes = new ArrayList<>();
        for (Sessao sessao : treino.sessoesOuVazio()) {
            List<ExercicioPlano> exercicios = new ArrayList<>();
            for (ExercicioPlano exercicio : sessao.exerciciosOuVazio()) {
                ExercicioDaBiblioteca biblioteca = exercicio.nome() == null
                        ? null : porBusca.get(Buscas.semAcento(exercicio.nome()));
                if (biblioteca == null) {
                    exercicios.add(exercicio);
                } else {
                    exercicios.add(new ExercicioPlano(exercicio.uid(), biblioteca.id(), biblioteca.nome(),
                            biblioteca.modalidade() != null ? biblioteca.modalidade() : exercicio.modalidade(),
                            exercicio.videoUrl(), exercicio.observacao(), exercicio.progressao(), exercicio.unidade(),
                            exercicio.series(), exercicio.cadencia(), exercicio.isometriaSegundos(),
                            exercicio.grupoUid()));
                }
            }
            sessoes.add(new Sessao(sessao.uid(), sessao.nome(), sessao.diaSemana(), sessao.tipo(),
                    sessao.frequenciaSemanal(), sessao.observacao(), sessao.cardio(), exercicios, sessao.grupos()));
        }
        return new Modelo(modelo.tipo(), modelo.nome(), modelo.descricao(),
                new ConteudoTreino(treino.objetivo(), treino.orientacoes(), sessoes, treino.metodologia()));
    }

    private static List<Modelo> lerSemanas() {
        List<Modelo> modelos = new ArrayList<>();
        for (String arquivo : SEMANAS_ARQUIVOS) {
            for (JsonNode modelo : LeitorDeModelos.modelos("receitas-padrao/semanas/" + arquivo)) {
                if (!"PLANO_TREINO".equals(modelo.path("tipo").asString())) {
                    throw new IllegalStateException("Semana padrão de outro tipo: " + arquivo);
                }
                modelos.add(new Modelo(Tipo.PLANO_TREINO, LeitorDeModelos.nome(modelo, arquivo),
                        LeitorDeModelos.descricao(modelo, arquivo),
                        LeitorDeModelos.json().treeToValue(modelo.get("conteudo"), ConteudoTreino.class)));
            }
        }
        return List.copyOf(modelos);
    }

    /** Um Dia por sessão de treino da Variação 1, com uids novos e sem dia da semana. */
    private static List<Modelo> derivarDias() {
        List<Modelo> dias = new ArrayList<>();
        for (Modelo semana : SEMANAS) {
            if (!VARIACAO_1.matcher(semana.nome()).find()) {
                continue;
            }
            String base = VARIACAO_1.matcher(semana.nome()).replaceFirst("");
            ConteudoTreino treino = (ConteudoTreino) semana.conteudo();
            for (Sessao sessao : treino.sessoesOuVazio()) {
                if (!ConteudoTreino.TREINO.equals(sessao.tipo())) {
                    continue;
                }
                String nome = base + " - " + sessao.nome();
                if (nome.length() > 120) {
                    throw new IllegalStateException("Nome de dia padrão longo demais: " + nome);
                }
                ConteudoTreino copia = new ConteudoTreino(null, null, List.of(sessao)).comUidsNovos();
                Sessao solta = copia.sessoes().get(0);
                Sessao semDia = new Sessao(solta.uid(), solta.nome(), null, solta.tipo(), solta.frequenciaSemanal(),
                        solta.observacao(), solta.cardio(), solta.exercicios(), solta.grupos());
                dias.add(new Modelo(Tipo.SESSAO_TREINO, nome,
                        "Dia de treino extraído da semana \"" + semana.nome() + "\".",
                        new ConteudoTreino(null, null, List.of(semDia))));
            }
        }
        return List.copyOf(dias);
    }

    private static List<Modelo> lerMobilidades() {
        List<Modelo> modelos = new ArrayList<>();
        String arquivo = "mobilidade.json";
        for (JsonNode modelo : LeitorDeModelos.modelos("receitas-padrao/mobilidade/" + arquivo)) {
            if (!"MOBILIDADE".equals(modelo.path("tipo").asString())) {
                throw new IllegalStateException("Mobilidade padrão de outro tipo: " + arquivo);
            }
            modelos.add(new Modelo(Tipo.MOBILIDADE, LeitorDeModelos.nome(modelo, arquivo),
                    LeitorDeModelos.descricao(modelo, arquivo),
                    LeitorDeModelos.json().treeToValue(modelo.get("conteudo"), ConteudoMobilidade.class)));
        }
        return List.copyOf(modelos);
    }
}
