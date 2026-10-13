package br.com.treinos.api.treino;

import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Conteúdo do plano de treino, guardado em {@code jsonb} no rascunho e em cada versão. Todo {@code uid} nasce
 * no cliente e é preservado ao editar: é ele que liga o registro do aluno à série. As anotações limitam o tamanho do
 * que chega; as regras de negócio ficam no {@link ValidadorTreino} (rascunho pode estar incompleto).
 */
public record ConteudoTreino(
        @Size(max = 200) String objetivo,
        @Size(max = 8000) String orientacoes,
        @NotNull @Size(max = 20) List<@Valid @NotNull Sessao> sessoes,
        @Valid Metodologia metodologia) {

    public record Metodologia(UUID id, @Size(max = 120) String nome,
                              @NotNull ConfiguracaoConsultoria configuracao) { }

    public ConteudoTreino(String objetivo, String orientacoes, List<Sessao> sessoes) {
        this(objetivo, orientacoes, sessoes, null);
    }

    public static final String TREINO = "TREINO";
    public static final String DESCANSO_ATIVO = "DESCANSO_ATIVO";
    public static final String DESCANSO = "DESCANSO";
    public static final String ACESSORIOS = "ACESSORIOS";
    public static final List<String> TIPOS_SESSAO = List.of(TREINO, DESCANSO_ATIVO, DESCANSO, ACESSORIOS);

    public static final String CARGA_TRABALHO = "CARGA_TRABALHO";
    public static final String PERCENTUAL_WS = "PERCENTUAL_WS";
    public static final List<String> MODOS = List.of(CARGA_TRABALHO, PERCENTUAL_WS, "RIR", "RPE", "LIVRE", "NENHUMA");

    public record Sessao(
            UUID uid,
            @Size(max = 80) String nome,
            Integer diaSemana,
            @Size(max = 20) String tipo,
            Integer frequenciaSemanal,
            @Size(max = 1000) String observacao,
            @Size(max = 500) String cardio,
            @Size(max = 40) List<@Valid @NotNull ExercicioPlano> exercicios) {

        public List<ExercicioPlano> exerciciosOuVazio() {
            return exercicios == null ? List.of() : exercicios;
        }
    }

    public record ExercicioPlano(
            UUID uid,
            UUID exercicioId,
            @Size(max = 120) String nome,
            @Size(max = 20) String modalidade,
            @Size(max = 500) String videoUrl,
            @Size(max = 1000) String observacao,
            Boolean progressao,
            @Size(max = 10) String unidade,
            @Size(max = 30) List<@Valid @NotNull Serie> series) {

        public List<Serie> seriesOuVazio() {
            return series == null ? List.of() : series;
        }
    }

    public record Serie(
            UUID uid,
            @Size(max = 30) String tipo,
            Integer repsMin,
            Integer repsMax,
            @Size(max = 120) String alvoTexto,
            @Valid Intensidade intensidade,
            Integer descansoSegundos) {

        public String modo() {
            return intensidade == null || intensidade.modo() == null ? "NENHUMA" : intensidade.modo();
        }

        public boolean deTrabalho() {
            return CARGA_TRABALHO.equals(modo());
        }
    }

    public record Intensidade(
            @Size(max = 20) String modo,
            BigDecimal percentual,
            Integer rir,
            BigDecimal rpe,
            @Size(max = 120) String texto) {
    }

    public static ConteudoTreino vazio() {
        return new ConteudoTreino(null, null, List.of());
    }

    public List<Sessao> sessoesOuVazio() {
        return sessoes == null ? List.of() : sessoes;
    }

    /** Cópia com todos os uids novos: receita aplicada, plano copiado ou replicado. */
    public ConteudoTreino comUidsNovos() {
        return comUids(UUID::randomUUID);
    }

    /** Mesmo treino com outra metodologia (a cópia das regras que acompanha o plano). */
    public ConteudoTreino comMetodologia(Metodologia nova) {
        return new ConteudoTreino(objetivo, orientacoes, sessoes, nova);
    }

    private ConteudoTreino comUids(Supplier<UUID> novo) {
        List<Sessao> novas = sessoesOuVazio().stream().map(s -> new Sessao(novo.get(), s.nome(), s.diaSemana(),
                s.tipo(), s.frequenciaSemanal(), s.observacao(), s.cardio(),
                s.exerciciosOuVazio().stream().map(e -> new ExercicioPlano(novo.get(), e.exercicioId(), e.nome(),
                        e.modalidade(), e.videoUrl(), e.observacao(), e.progressao(), e.unidade(),
                        e.seriesOuVazio().stream().map(x -> new Serie(novo.get(), x.tipo(), x.repsMin(), x.repsMax(),
                                x.alvoTexto(), x.intensidade(), x.descansoSegundos())).toList())).toList())).toList();
        return new ConteudoTreino(objetivo, orientacoes, novas, metodologia);
    }
}
