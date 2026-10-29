package br.com.treinos.api.agenda;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

/**
 * Evento SEM aluno de uma agenda pessoal (D3). Guarda a REGRA de repetição (data e hora de Brasília, não instante); as
 * ocorrências saem da expansão na leitura e as alterações de uma ocorrência ficam em {@link ExcecaoDeEvento}. Só o dono
 * lê e altera. Título, local e descrição são texto livre do membro: nunca em log nem na auditoria.
 */
@Entity
@Table(name = "evento_agenda")
public class EventoAgenda {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "dono_id", nullable = false, updatable = false)
    private UUID donoId;

    @Column(name = "agenda_id", nullable = false)
    private UUID agendaId;

    @Column(nullable = false)
    private String titulo;

    private String descricao;
    private String local;

    @Column(name = "data_inicio", nullable = false)
    private LocalDate dataInicio;

    /** Nulo = dia inteiro. */
    @Column(name = "hora_inicio")
    private LocalTime horaInicio;

    @Column(name = "duracao_minutos")
    private Integer duracaoMinutos;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoDeRecorrencia recorrencia = TipoDeRecorrencia.NENHUMA;

    @Column(name = "dias_da_semana")
    private Short diasDaSemana;

    @Column(name = "repete_ate")
    private LocalDate repeteAte;

    @Column(name = "repete_vezes")
    private Short repeteVezes;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm = criadoEm;

    @Version
    private Long versao;

    protected EventoAgenda() {
    }

    EventoAgenda(UUID donoId) {
        this.donoId = donoId;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getDonoId() { return donoId; }
    public UUID getAgendaId() { return agendaId; }
    public String getTitulo() { return titulo; }
    public String getDescricao() { return descricao; }
    public String getLocal() { return local; }
    public LocalDate getDataInicio() { return dataInicio; }
    public LocalTime getHoraInicio() { return horaInicio; }
    public Integer getDuracaoMinutos() { return duracaoMinutos; }
    public TipoDeRecorrencia getRecorrencia() { return recorrencia; }
    public LocalDate getRepeteAte() { return repeteAte; }
    public Long getVersao() { return versao; }
    public boolean isDiaInteiro() { return horaInicio == null; }
    public boolean repete() { return recorrencia != TipoDeRecorrencia.NENHUMA; }

    /** A regra de repetição como a classe pura a entende. */
    RecorrenciaDeEvento.Regra regra() {
        return new RecorrenciaDeEvento.Regra(recorrencia,
                diasDaSemana == null ? Set.of() : RecorrenciaDeEvento.dias(diasDaSemana),
                repeteAte, vezes());
    }

    Integer vezes() {
        return repeteVezes == null ? null : repeteVezes.intValue();
    }

    /** Conteúdo e horário do evento (sem a regra). Sem hora = dia inteiro. */
    void definirConteudo(UUID agendaId, String titulo, String descricao, String local, LocalDate dataInicio,
                         LocalTime horaInicio, Integer duracaoMinutos) {
        this.agendaId = agendaId;
        this.titulo = titulo;
        this.descricao = descricao;
        this.local = local;
        this.dataInicio = dataInicio;
        this.horaInicio = horaInicio;
        this.duracaoMinutos = horaInicio == null ? null : duracaoMinutos;
        tocar();
    }

    void definirRegra(RecorrenciaDeEvento.Regra regra) {
        this.recorrencia = regra.tipo();
        this.diasDaSemana = regra.tipo() == TipoDeRecorrencia.SEMANAL
                ? Short.valueOf((short) RecorrenciaDeEvento.mascara(regra.dias())) : null;
        this.repeteAte = regra.ate();
        this.repeteVezes = regra.vezes() == null ? null : Short.valueOf(regra.vezes().shortValue());
        tocar();
    }

    /**
     * Marca que algo do evento mudou sem mexer nas colunas dele (uma exceção entrou, mudou ou saiu): sobe a
     * {@code versao}, que protege também as mudanças por ocorrência.
     */
    void tocar() {
        Instant agora = Instant.now();
        // Sempre diferente do valor anterior, senão o Hibernate não vê alteração e a versão não sobe.
        this.atualizadoEm = agora.isAfter(atualizadoEm) ? agora : atualizadoEm.plusNanos(1_000);
    }
}
