package br.com.treinos.api.importacao.assistida;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Arquivo ou texto anexado a uma sessão de importação assistida.
 */
@Entity
@Table(name = "importacao_arquivo")
public class ImportacaoArquivo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "sessao_id", nullable = false, updatable = false)
    private UUID sessaoId;

    @Column(name = "nome_original", nullable = false, length = 255)
    private String nomeOriginal;

    @Column(nullable = false, length = 24)
    private String formato;

    @Column(name = "hash_sha256", nullable = false, length = 64)
    private String hashSha256;

    @Column(name = "tamanho_bytes", nullable = false)
    private long tamanhoBytes;

    @Column(nullable = false, length = 32)
    private String estado;

    @Column(name = "conteudo_bytes")
    private byte[] conteudoBytes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extracao_json", columnDefinition = "jsonb")
    private String extracaoJson;

    @Column(name = "erro_codigo", length = 64)
    private String erroCodigo;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    protected ImportacaoArquivo() {
    }

    public ImportacaoArquivo(UUID sessaoId, String nomeOriginal, String formato, String hashSha256,
                             long tamanhoBytes, byte[] conteudoBytes) {
        this.sessaoId = sessaoId;
        this.nomeOriginal = nomeOriginal != null ? nomeOriginal.strip() : "arquivo";
        this.formato = formato;
        this.hashSha256 = hashSha256;
        this.tamanhoBytes = tamanhoBytes;
        this.conteudoBytes = conteudoBytes;
        this.estado = "RECEBIDO";
        this.criadoEm = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public UUID getSessaoId() {
        return sessaoId;
    }

    public String getNomeOriginal() {
        return nomeOriginal;
    }

    public String getFormato() {
        return formato;
    }

    public String getHashSha256() {
        return hashSha256;
    }

    public long getTamanhoBytes() {
        return tamanhoBytes;
    }

    public String getEstado() {
        return estado;
    }

    public byte[] getConteudoBytes() {
        return conteudoBytes;
    }

    public String getExtracaoJson() {
        return extracaoJson;
    }

    public String getErroCodigo() {
        return erroCodigo;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public void marcarProcessado(String extracaoJson) {
        this.estado = "PROCESSADO";
        this.extracaoJson = extracaoJson;
        this.erroCodigo = null;
    }

    public void marcarErro(String erroCodigo) {
        this.estado = "ERRO";
        this.erroCodigo = erroCodigo;
    }

    public void limparConteudoBytes() {
        this.conteudoBytes = null;
    }

    @Override
    public String toString() {
        return "ImportacaoArquivo[id=" + id + ", formato=" + formato + ", estado=" + estado + "]";
    }
}
