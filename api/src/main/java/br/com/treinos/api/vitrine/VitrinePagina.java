package br.com.treinos.api.vitrine;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Página pública da loja da consultoria (V077, {@code vitrine_configuracao}): o código do link e se a página está ligada. O código
 * nunca vai a log, auditoria nem {@code toString}.
 */
@Entity
@Table(name = "vitrine_configuracao")
public class VitrinePagina {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "codigo_publico", nullable = false)
    private String codigoPublico;

    @Column(name = "pagina_ligada", nullable = false)
    private boolean paginaLigada;

    @Column(name = "no_marketplace", nullable = false)
    private boolean noMarketplace;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm = criadoEm;

    @Version
    private Long versao;

    protected VitrinePagina() {
    }

    VitrinePagina(String codigoPublico) {
        this.codigoPublico = codigoPublico;
    }

    public String getCodigoPublico() { return codigoPublico; }
    public boolean isPaginaLigada() { return paginaLigada; }
    public boolean isNoMarketplace() { return noMarketplace; }
    public Long getVersao() { return versao; }

    void ligar(boolean ligada) {
        this.paginaLigada = ligada;
        this.atualizadoEm = Instant.now();
    }

    void entrarNoMarketplace(boolean entra) {
        this.noMarketplace = entra;
        this.atualizadoEm = Instant.now();
    }

    void novoCodigo(String codigo) {
        this.codigoPublico = codigo;
        this.atualizadoEm = Instant.now();
    }

    @Override
    public String toString() {
        return "VitrinePagina[" + id + "]";
    }
}
