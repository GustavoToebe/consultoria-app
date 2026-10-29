package br.com.treinos.api.agenda;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/** Contratos da agenda presencial. Data e hora entram e saem no horário de Brasília; {@code inicio}/{@code fim} são instantes. */
public final class AgendaDtos {

    private AgendaDtos() { }

    /** Limites da API, espelhados em {@code app/src/dominio/agendaPresencial.ts}. */
    public static final int DURACAO_MINIMA = 5;
    public static final int DURACAO_MAXIMA = 480;
    public static final int LOCAL_MAXIMO = 120;
    public static final int OBSERVACAO_MAXIMA = 500;

    /** Máximo de alunos num compromisso (D11). */
    public static final int ALUNOS_MAXIMO = 20;

    /**
     * Marcar ou remarcar. {@code alunoIds} é a lista inteira de participantes (1 a {@value #ALUNOS_MAXIMO}, sem repetir): no
     * PUT, quem entra nasce {@code AGENDADO} e quem sai é apagado do compromisso. {@code data} e {@code hora} são do horário
     * de Brasília (nunca do fuso do servidor nem do aparelho). {@code versao} é obrigatória só ao remarcar (PUT).
     * {@code observacao} só é gravada por quem tem {@code ALUNO_SENSIVEL_ALTERAR}; sem ela é ignorada (a gravada fica).
     */
    public record CompromissoRequest(@NotNull @Size(min = 1, max = ALUNOS_MAXIMO) List<@NotNull UUID> alunoIds,
                                     @NotNull UUID responsavelId, @NotNull LocalDate data, @NotNull LocalTime hora,
                                     @NotNull @Min(DURACAO_MINIMA) @Max(DURACAO_MAXIMA) Integer duracaoMinutos,
                                     @Size(max = LOCAL_MAXIMO) String local,
                                     @Size(max = OBSERVACAO_MAXIMA) String observacao, Long versao) { }

    /** Cancelar o compromisso inteiro ({@code true}, todos os participantes) ou reabrir ({@code false}). */
    public record CancelamentoRequest(@NotNull Boolean cancelado, @NotNull Long versao) { }

    /** A situação de um participante: realizado e falta só depois do início do compromisso. */
    public record SituacaoDoAlunoRequest(@NotNull SituacaoCompromisso situacao, @NotNull Long versao) { }

    /** Um participante para a equipe: {@code id} é o do aluno (é o da rota da situação dele). */
    public record Participante(UUID id, String nome, SituacaoCompromisso situacao) { }

    /**
     * Um compromisso para a equipe. {@code observacao} sai nula sem {@code ALUNO_SENSIVEL_LER}. {@code data} e
     * {@code hora} ("HH:mm") são do início em Brasília. A situação de cada aluno está em {@code participantes} (por nome);
     * {@code cancelado} é o compromisso inteiro.
     */
    public record CompromissoResponse(UUID id, UUID responsavelId, String responsavelNome, Instant inicio, Instant fim,
                                      LocalDate data, String hora, String horaFim, int duracaoMinutos, String local,
                                      String observacao, boolean cancelado, List<Participante> participantes,
                                      long versao) { }

    /** Aluno que já tem outro compromisso sobreposto (só aviso): id e nome, sem horário nem observação do outro. */
    public record AlunoOcupado(UUID id, String nome) { }

    /**
     * O que o aluno vê dos próprios compromissos: quando, onde, com quem e a situação DELE. Sem a observação (texto de
     * trabalho da equipe), sem a lista de participantes e sem ids de aluno ou da equipe (o {@code id} é o do compromisso).
     */
    public record CompromissoDoAluno(UUID id, Instant inicio, Instant fim, LocalDate data, String hora, String horaFim,
                                     int duracaoMinutos, String local, SituacaoCompromisso situacao,
                                     String responsavelNome) { }

    /**
     * Seção {@code compromissos} da exportação do aluno (LGPD): o compromisso com a situação DELE, sem os nomes dos outros
     * participantes. Com mais de um participante a {@code observacao} sai nula (texto compartilhado da equipe, pode citar
     * outro aluno).
     */
    public record CompromissoExportado(UUID id, Instant inicio, LocalDate data, String hora, int duracaoMinutos,
                                       String local, String observacao, SituacaoCompromisso situacao,
                                       String responsavelNome, Instant criadoEm) { }
}
