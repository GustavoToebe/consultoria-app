package br.com.treinos.api.agenda;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/** Contratos da agenda presencial. Data e hora entram e saem no horário de Brasília; {@code inicio}/{@code fim} são instantes. */
public final class AgendaDtos {

    private AgendaDtos() { }

    /** Limites da API, espelhados em {@code app/src/dominio/agendaPresencial.ts}. */
    public static final int DURACAO_MINIMA = 5;
    public static final int DURACAO_MAXIMA = 480;
    public static final int LOCAL_MAXIMO = 120;
    public static final int OBSERVACAO_MAXIMA = 500;

    /**
     * Marcar ou remarcar. {@code data} e {@code hora} são do horário de Brasília (nunca do fuso do servidor nem do
     * aparelho). {@code versao} é obrigatória só ao remarcar (PUT). {@code observacao} só é gravada por quem tem
     * {@code ALUNO_SENSIVEL_ALTERAR}; sem ela é ignorada (a gravada fica).
     */
    public record CompromissoRequest(@NotNull UUID alunoId, @NotNull UUID responsavelId, @NotNull LocalDate data,
                                     @NotNull LocalTime hora,
                                     @NotNull @Min(DURACAO_MINIMA) @Max(DURACAO_MAXIMA) Integer duracaoMinutos,
                                     @Size(max = LOCAL_MAXIMO) String local,
                                     @Size(max = OBSERVACAO_MAXIMA) String observacao, Long versao) { }

    public record SituacaoRequest(@NotNull SituacaoCompromisso situacao, @NotNull Long versao) { }

    /**
     * Um compromisso para a equipe. {@code observacao} sai nula sem {@code ALUNO_SENSIVEL_LER}. {@code data} e
     * {@code hora} ("HH:mm") são do início em Brasília.
     */
    public record CompromissoResponse(UUID id, UUID alunoId, String alunoNome, UUID responsavelId, String responsavelNome,
                                      Instant inicio, Instant fim, LocalDate data, String hora, String horaFim,
                                      int duracaoMinutos, String local, String observacao, SituacaoCompromisso situacao,
                                      long versao) { }

    /**
     * O que o aluno vê dos próprios compromissos: quando, onde, com quem e a situação. Sem a observação (texto de
     * trabalho da equipe) e sem ids da equipe.
     */
    public record CompromissoDoAluno(UUID id, Instant inicio, Instant fim, LocalDate data, String hora, String horaFim,
                                     int duracaoMinutos, String local, SituacaoCompromisso situacao,
                                     String responsavelNome) { }

    /** Seção {@code compromissos} da exportação do aluno (LGPD): tudo o que a consultoria guarda, com a observação. */
    public record CompromissoExportado(UUID id, Instant inicio, LocalDate data, String hora, int duracaoMinutos,
                                       String local, String observacao, SituacaoCompromisso situacao,
                                       String responsavelNome, Instant criadoEm) { }
}
