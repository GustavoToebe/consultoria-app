package br.com.treinos.api.agenda;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * Compromisso presencial da agenda do consultório (consulta, retorno, avaliação): marcado só pela equipe, com de 1 a 20
 * alunos (participantes em {@link CompromissoAluno}, cada um com a sua situação) e um responsável da equipe. O início é um
 * instante; a API mostra e recebe sempre no horário de Brasília. {@code fim} é guardado (início + duração) para a
 * conferência de sobreposição. {@code cancelado} é o compromisso inteiro (todos os participantes cancelados) e é o que
 * libera o horário do responsável. {@code serieId} liga as ocorrências de uma série (passo 2 do plano). A observação é
 * texto livre da equipe e pode ter dado de saúde: nunca em log nem na auditoria.
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

    @Column(nullable = false)
    private boolean cancelado;

    @Column(name = "serie_id")
    private UUID serieId;

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

    Compromisso(UUID responsavelId, Instant inicio, int duracaoMinutos, String local, String observacao, UUID criadoPor) {
        this.criadoPor = criadoPor;
        alterar(responsavelId, inicio, duracaoMinutos, local, observacao);
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getResponsavelId() { return responsavelId; }
    public Instant getInicio() { return inicio; }
    public int getDuracaoMinutos() { return duracaoMinutos; }
    public Instant getFim() { return fim; }
    public String getLocal() { return local; }
    public String getObservacao() { return observacao; }
    public boolean isCancelado() { return cancelado; }
    public UUID getSerieId() { return serieId; }
    public UUID getCriadoPor() { return criadoPor; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getAtualizadoEm() { return atualizadoEm; }
    public Long getVersao() { return versao; }

    /** Fim calculado sempre aqui, para nunca divergir do início e da duração. */
    static Instant fimDe(Instant inicio, int duracaoMinutos) {
        return inicio.plus(Duration.ofMinutes(duracaoMinutos));
    }

    final void alterar(UUID responsavelId, Instant inicio, int duracaoMinutos, String local, String observacao) {
        this.responsavelId = responsavelId;
        this.inicio = inicio;
        this.duracaoMinutos = duracaoMinutos;
        this.fim = fimDe(inicio, duracaoMinutos);
        this.local = local;
        this.observacao = observacao;
        tocar();
    }

    /** O compromisso inteiro cancelado (ou reaberto). Quem decide é o serviço, pela situação dos participantes. */
    void definirCancelado(boolean cancelado) {
        this.cancelado = cancelado;
        tocar();
    }

    /**
     * Marca que algo do compromisso mudou sem mexer nas colunas dele (um participante entrou, saiu ou mudou de situação):
     * sobe a {@code versao}, que protege também as mudanças por aluno.
     */
    final void tocar() {
        Instant agora = Instant.now();
        // Sempre diferente do valor anterior, senão o Hibernate não vê alteração e a versão não sobe.
        this.atualizadoEm = agora.isAfter(atualizadoEm) ? agora : atualizadoEm.plusNanos(1_000);
    }
}
