package br.com.treinos.api.agenda;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Contratos das agendas pessoais, dos eventos sem aluno e do resumo do Ano (docs/planos/agenda-calendario.md). Data e hora
 * entram e saem no horário de Brasília; {@code inicio}/{@code fim} são instantes. Título, local, descrição e nome da
 * agenda são texto livre do membro: nunca em log nem na auditoria.
 */
public final class AgendaCalendarioDtos {

    private AgendaCalendarioDtos() { }

    public static final int NOME_DA_AGENDA_MAXIMO = 40;
    public static final int TITULO_MAXIMO = 120;
    public static final int LOCAL_MAXIMO = 120;
    public static final int DESCRICAO_MAXIMA = 1000;
    public static final int EVENTO_DURACAO_MINIMA = 5;
    public static final int EVENTO_DURACAO_MAXIMA = 1440;

    /** Chaves da paleta fixa (D7); o app tem o par claro e escuro de cada uma. */
    public static final Set<String> CORES = Set.of("AZUL", "INDIGO", "VIOLETA", "MAGENTA", "TURQUESA", "ARDOSIA", "TERRA",
            "OLIVA");

    /** Criar ({@code versao} ignorada) ou renomear/recolorir ({@code versao} obrigatória). {@code cor} é uma de {@link #CORES}. */
    public record AgendaRequest(@NotBlank @Size(max = NOME_DA_AGENDA_MAXIMO) String nome, @NotBlank String cor,
                                Long versao) {
        @Override
        public String toString() {
            return "AgendaRequest[cor=" + cor + ", versao=" + versao + "]";
        }
    }

    public record AgendaResponse(UUID id, String nome, String cor, long versao) {
        @Override
        public String toString() {
            return "AgendaResponse[id=" + id + ", versao=" + versao + "]";
        }
    }

    /** Quantos eventos (séries, não ocorrências) a agenda tem: o número da confirmação de apagar. */
    public record ContagemDaAgenda(long eventos) { }

    /**
     * Repetição de um evento. {@code tipo} {@code NENHUMA} (ou a repetição ausente) = evento avulso. O fim é opcional e
     * no máximo um dos dois: {@code ate} (data de Brasília, inclusive) ou {@code vezes} (2 a 999, a primeira conta); sem
     * nenhum, nunca termina. {@code diasDaSemana} só em {@code SEMANAL}, com os nomes de {@link java.time.DayOfWeek}
     * ({@code MONDAY}...): texto, nunca número.
     */
    public record RepeticaoDeEvento(@NotNull TipoDeRecorrencia tipo, Set<String> diasDaSemana, LocalDate ate,
                                    Integer vezes) { }

    /**
     * Criar ou alterar um evento. Dia inteiro ({@code diaInteiro}) ignora {@code hora} e {@code duracaoMinutos}; com hora,
     * os dois são obrigatórios (a hora é de Brasília, a duração de 5 a 1440). {@code versao} obrigatória só no PUT. No PUT
     * de uma série, {@code escopo} {@code ESTA} ignora {@code repeticao} e não troca de agenda.
     */
    public record EventoRequest(@NotNull UUID agendaId, @NotBlank @Size(max = TITULO_MAXIMO) String titulo,
                                @Size(max = LOCAL_MAXIMO) String local, @Size(max = DESCRICAO_MAXIMA) String descricao,
                                @NotNull LocalDate data, boolean diaInteiro, LocalTime hora,
                                @Min(EVENTO_DURACAO_MINIMA) @Max(EVENTO_DURACAO_MAXIMA) Integer duracaoMinutos,
                                @Valid RepeticaoDeEvento repeticao, Long versao) {
        @Override
        public String toString() {
            return "EventoRequest[agendaId=" + agendaId + ", data=" + data + ", versao=" + versao + "]";
        }
    }

    /**
     * Pergunta de leitura "o evento que estou montando cruza outro meu?" (o aviso da folha do evento; nunca grava nem
     * bloqueia). Os campos de horário e de repetição são os de {@link EventoRequest}; sem título, local, descrição nem
     * agenda. {@code eventoId} (opcional, na edição) é o próprio evento: nenhuma ocorrência dele conta. Dia inteiro não
     * cruza (o aviso da tela também o ignora): resposta zerada.
     */
    public record CruzamentoRequest(UUID eventoId, @NotNull LocalDate data, boolean diaInteiro, LocalTime hora,
                                    @Min(EVENTO_DURACAO_MINIMA) @Max(EVENTO_DURACAO_MAXIMA) Integer duracaoMinutos,
                                    @Valid RepeticaoDeEvento repeticao) { }

    /**
     * Quantas ocorrências do evento pedido (em até um ano) cruzam algum outro evento do membro e as primeiras
     * {@code datas} delas (de Brasília, em ordem, no máximo {@value EventoAgendaService#CRUZAMENTOS_DATAS}).
     * {@code incompleto}: a conta bateu num teto de segurança e pode estar maior. Nada de texto de outro evento.
     */
    public record CruzamentoResponse(int quantidade, List<LocalDate> datas, boolean incompleto) { }

    /**
     * Uma ocorrência já expandida (com a exceção aplicada). {@code dataOriginal} é o dia da regra (a chave para editar ou
     * excluir só esta); {@code data} é onde ela cai hoje (difere se foi movida). Dia inteiro: {@code hora} e
     * {@code horaFim} nulos e {@code inicio}/{@code fim} são o começo do dia e o do dia seguinte em Brasília.
     * {@code recorrente} diz que o evento tem regra de repetição.
     */
    public record OcorrenciaDeEvento(UUID eventoId, UUID agendaId, LocalDate dataOriginal, LocalDate data, String hora,
                                     String horaFim, Instant inicio, Instant fim, boolean diaInteiro, String titulo,
                                     String local, String descricao, boolean recorrente) {
        @Override
        public String toString() {
            return "OcorrenciaDeEvento[eventoId=" + eventoId + ", agendaId=" + agendaId + ", data=" + data + "]";
        }
    }

    /**
     * O evento (a regra) e, em {@code ocorrencia}, a pedida em {@code ?ocorrencia=AAAA-MM-DD} ou, sem ela, a primeira;
     * nulo se essa foi cancelada. {@code data} é o primeiro dia da regra; {@code repeticao} é nula no evento avulso.
     */
    public record EventoResponse(UUID id, UUID agendaId, String titulo, String local, String descricao, LocalDate data,
                                 boolean diaInteiro, String hora, Integer duracaoMinutos, RepeticaoDeEvento repeticao,
                                 long versao, OcorrenciaDeEvento ocorrencia) {
        @Override
        public String toString() {
            return "EventoResponse[id=" + id + ", agendaId=" + agendaId + ", versao=" + versao + "]";
        }
    }

    /** Um dia do resumo do Ano: só contagens, sem título nem nome. Dias sem nada não aparecem. */
    public record DiaDoResumo(LocalDate data, int compromissos, int eventos) { }

    public record ResumoDaAgenda(List<DiaDoResumo> dias) { }
}
