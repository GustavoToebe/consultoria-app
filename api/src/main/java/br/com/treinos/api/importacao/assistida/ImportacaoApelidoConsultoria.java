package br.com.treinos.api.importacao.assistida;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Memória de abreviações e sinonímias da consultoria (ex.: "Puxada frent" -> "Puxada frontal pronada").
 * Isolada por consultoria com @TenantId e restrição de unicidade.
 */
@Entity
@Table(name = "importacao_apelido_consultoria")
public class ImportacaoApelidoConsultoria {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false, length = 24)
    private String tipo;

    @Column(name = "termo_normalizado", nullable = false, length = 160)
    private String termoNormalizado;

    @Column(name = "termo_original", nullable = false, length = 160)
    private String termoOriginal;

    @Column(name = "referencia_id")
    private UUID referenciaId;

    @Column(name = "valor_mapeado", nullable = false, length = 160)
    private String valorMapeado;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected ImportacaoApelidoConsultoria() {
    }

    public ImportacaoApelidoConsultoria(String tipo, String termoNormalizado, String termoOriginal,
                                        UUID referenciaId, String valorMapeado) {
        this.tipo = tipo;
        this.termoNormalizado = termoNormalizado;
        this.termoOriginal = termoOriginal;
        this.referenciaId = referenciaId;
        this.valorMapeado = valorMapeado;
        this.criadoEm = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public String getTipo() {
        return tipo;
    }

    public String getTermoNormalizado() {
        return termoNormalizado;
    }

    public String getTermoOriginal() {
        return termoOriginal;
    }

    public UUID getReferenciaId() {
        return referenciaId;
    }

    public String getValorMapeado() {
        return valorMapeado;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public void atualizarMapeamento(String novoValor, UUID novaReferencia) {
        this.valorMapeado = novoValor;
        this.referenciaId = novaReferencia;
    }

    @Override
    public String toString() {
        return "ImportacaoApelidoConsultoria[id=" + id + ", tipo=" + tipo + "]";
    }
}
