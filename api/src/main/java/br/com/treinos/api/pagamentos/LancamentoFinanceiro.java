package br.com.treinos.api.pagamentos;

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
import java.util.UUID;

/**
 * Entrada ou saída avulsa da consultoria (não vem de cobrança, não tem aluno). A descrição é texto do treinador: nunca em
 * log nem em auditoria.
 */
@Entity
@Table(name = "lancamento_financeiro")
public class LancamentoFinanceiro {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false)
    private LocalDate data;
    @Column(nullable = false)
    private String descricao;
    @Column(name = "valor_centavos", nullable = false)
    private long valorCentavos;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoDeLancamento tipo;
    private String categoria;
    @Column(name = "criado_por", updatable = false)
    private UUID criadoPor;
    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
    @Version
    private Long versao;

    protected LancamentoFinanceiro() {
    }

    LancamentoFinanceiro(UUID criadoPor) {
        this.criadoPor = criadoPor;
    }

    void preencher(LocalDate data, String descricao, long valorCentavos, TipoDeLancamento tipo, String categoria) {
        this.data = data;
        this.descricao = descricao;
        this.valorCentavos = valorCentavos;
        this.tipo = tipo;
        this.categoria = categoria;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public LocalDate getData() { return data; }
    public String getDescricao() { return descricao; }
    public long getValorCentavos() { return valorCentavos; }
    public TipoDeLancamento getTipo() { return tipo; }
    public String getCategoria() { return categoria; }
    public UUID getCriadoPor() { return criadoPor; }
    public Instant getCriadoEm() { return criadoEm; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "LancamentoFinanceiro[" + id + "]";
    }
}
