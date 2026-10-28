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

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Compromisso presencial da agenda do consultório (consulta, retorno, avaliação): marcado só pela equipe, com um aluno e
 * um responsável da equipe. O início é um instante; a API mostra e recebe sempre no horário de Brasília. {@code fim} é
 * guardado (início + duração) para a conferência de sobreposição. A observação é texto livre da equipe e pode ter dado de
 * saúde: nunca em log nem na auditoria.
 */
@Entity
@Table(name = "compromisso")
public class Compromisso {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false)
    private UUID alunoId;

    @Column(name = "responsavel_id")
    private UUID responsavelId;

    @Column(nullable = false)
    private Instant inicio;

    @Column(name = "duracao_minutos", nullable = false)
    private int duracaoMinutos;

    @Column(nullable = false)
    private Instant fim;

    private String local;

    private String observacao;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SituacaoCompromisso situacao = SituacaoCompromisso.AGENDADO;

    @Column(name = "criado_por", updatable = false)
    private UUID criadoPor;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm = criadoEm;

    @Version
    private Long versao;

    protected Compromisso() {
    }

    Compromisso(UUID alunoId, UUID responsavelId, Instant inicio, int duracaoMinutos, String local, String observacao,
                UUID criadoPor) {
        this.criadoPor = criadoPor;
        alterar(alunoId, responsavelId, inicio, duracaoMinutos, local, observacao);
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getResponsavelId() { return responsavelId; }
    public Instant getInicio() { return inicio; }
    public int getDuracaoMinutos() { return duracaoMinutos; }
    public Instant getFim() { return fim; }
    public String getLocal() { return local; }
    public String getObservacao() { return observacao; }
    public SituacaoCompromisso getSituacao() { return situacao; }
    public UUID getCriadoPor() { return criadoPor; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getAtualizadoEm() { return atualizadoEm; }
    public Long getVersao() { return versao; }

    /** Fim calculado sempre aqui, para nunca divergir do início e da duração. */
    static Instant fimDe(Instant inicio, int duracaoMinutos) {
        return inicio.plus(Duration.ofMinutes(duracaoMinutos));
    }

    final void alterar(UUID alunoId, UUID responsavelId, Instant inicio, int duracaoMinutos, String local, String observacao) {
        this.alunoId = alunoId;
        this.responsavelId = responsavelId;
        this.inicio = inicio;
        this.duracaoMinutos = duracaoMinutos;
        this.fim = fimDe(inicio, duracaoMinutos);
        this.local = local;
        this.observacao = observacao;
        this.atualizadoEm = Instant.now();
    }

    void alterarSituacao(SituacaoCompromisso nova) {
        this.situacao = nova;
        this.atualizadoEm = Instant.now();
    }
}
