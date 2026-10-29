package br.com.treinos.api.avaliacoes;

import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.Medidas;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Avaliação física do aluno numa data: só circunferências em cm e uma observação. Dado sensível (LGPD): nunca em log,
 * auditoria com valor ou mensagem de erro; nenhum {@code toString} com as medidas.
 */
@Entity
@Table(name = "avaliacao_fisica")
public class AvaliacaoFisica {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "aluno_id", nullable = false, updatable = false)
    private UUID alunoId;

    @Column(nullable = false)
    private LocalDate data;

    @Column(name = "braco_direito_cm")
    private BigDecimal bracoDireito;
    @Column(name = "braco_esquerdo_cm")
    private BigDecimal bracoEsquerdo;
    @Column(name = "peitoral_cm")
    private BigDecimal peitoral;
    @Column(name = "cintura_cm")
    private BigDecimal cintura;
    @Column(name = "abdomen_cm")
    private BigDecimal abdomen;
    @Column(name = "quadril_cm")
    private BigDecimal quadril;
    @Column(name = "coxa_direita_cm")
    private BigDecimal coxaDireita;
    @Column(name = "coxa_esquerda_cm")
    private BigDecimal coxaEsquerda;
    @Column(name = "panturrilha_direita_cm")
    private BigDecimal panturrilhaDireita;
    @Column(name = "panturrilha_esquerda_cm")
    private BigDecimal panturrilhaEsquerda;

    private String observacao;

    @Version
    private Long versao;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "criado_por", nullable = false, updatable = false)
    private UUID criadoPor;

    @Column(name = "alterado_em", nullable = false)
    private Instant alteradoEm;

    @Column(name = "alterado_por", nullable = false)
    private UUID alteradoPor;

    protected AvaliacaoFisica() {
    }

    AvaliacaoFisica(UUID alunoId, UUID criadoPor) {
        this.alunoId = alunoId;
        this.criadoPor = criadoPor;
        // Preenchido aqui (e não só pelo default do banco) para a resposta do POST já levar a data de criação.
        this.criadoEm = Instant.now();
    }

    /** Valores já conferidos por {@link ValidacaoDaAvaliacao}. */
    void preencher(LocalDate data, Medidas m, String observacao, UUID usuarioId) {
        this.data = data;
        this.bracoDireito = m.bracoDireito();
        this.bracoEsquerdo = m.bracoEsquerdo();
        this.peitoral = m.peitoral();
        this.cintura = m.cintura();
        this.abdomen = m.abdomen();
        this.quadril = m.quadril();
        this.coxaDireita = m.coxaDireita();
        this.coxaEsquerda = m.coxaEsquerda();
        this.panturrilhaDireita = m.panturrilhaDireita();
        this.panturrilhaEsquerda = m.panturrilhaEsquerda();
        this.observacao = observacao;
        this.alteradoPor = usuarioId;
        this.alteradoEm = Instant.now();
    }

    Medidas medidas() {
        return new Medidas(bracoDireito, bracoEsquerdo, peitoral, cintura, abdomen, quadril, coxaDireita, coxaEsquerda,
                panturrilhaDireita, panturrilhaEsquerda);
    }

    public UUID getId() {
        return id;
    }

    public UUID getAlunoId() {
        return alunoId;
    }

    public LocalDate getData() {
        return data;
    }

    public String getObservacao() {
        return observacao;
    }

    public Long getVersao() {
        return versao;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Instant getAlteradoEm() {
        return alteradoEm;
    }
}
