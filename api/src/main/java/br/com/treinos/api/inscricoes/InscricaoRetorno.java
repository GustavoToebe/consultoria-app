package br.com.treinos.api.inscricoes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Retorno marcado numa inscrição (a próxima ação do atendimento): descrição curta, data de Brasília e responsável.
 * Concluir guarda quem e quando; reagendar troca data, descrição e responsável (com a versão). Só aparece na tela, sem
 * notificação. Sai junto com a inscrição.
 */
@Entity
@Table(name = "inscricao_retorno")
public class InscricaoRetorno {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "inscricao_id", nullable = false, updatable = false)
    private UUID inscricaoId;

    @Column(nullable = false)
    private String descricao;

    @Column(nullable = false)
    private LocalDate data;

    @Column(name = "responsavel_id")
    private UUID responsavelId;

    @Column(name = "concluido_em")
    private Instant concluidoEm;

    @Column(name = "concluido_por")
    private UUID concluidoPor;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "criado_por", updatable = false)
    private UUID criadoPor;

    @Version
    private Long versao;

    protected InscricaoRetorno() {
    }

    InscricaoRetorno(UUID inscricaoId, String descricao, LocalDate data, UUID responsavelId, UUID criadoPor) {
        this.inscricaoId = inscricaoId;
        this.descricao = descricao;
        this.data = data;
        this.responsavelId = responsavelId;
        this.criadoPor = criadoPor;
    }

    public UUID getId() { return id; }
    public UUID getInscricaoId() { return inscricaoId; }
    public String getDescricao() { return descricao; }
    public LocalDate getData() { return data; }
    public UUID getResponsavelId() { return responsavelId; }
    public Instant getConcluidoEm() { return concluidoEm; }
    public UUID getConcluidoPor() { return concluidoPor; }
    public Instant getCriadoEm() { return criadoEm; }
    public UUID getCriadoPor() { return criadoPor; }
    public Long getVersao() { return versao; }

    boolean pendente() {
        return concluidoEm == null;
    }

    void alterar(String descricao, LocalDate data, UUID responsavelId) {
        this.descricao = descricao;
        this.data = data;
        this.responsavelId = responsavelId;
    }

    void concluir(UUID quem) {
        this.concluidoEm = Instant.now();
        this.concluidoPor = quem;
    }
}
