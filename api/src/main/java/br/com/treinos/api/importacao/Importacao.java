package br.com.treinos.api.importacao;

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

/** Uma importação confirmada. Sem o arquivo e sem valor de célula. */
@Entity
@Table(name = "importacao")
public class Importacao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false, length = 20)
    private String destino;

    @Column(name = "nome_arquivo", nullable = false, length = 200)
    private String nomeArquivo;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private UUID usuarioId;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(nullable = false)
    private int linhas;

    @Column(nullable = false)
    private int novos;

    @Column(nullable = false)
    private int atualizados;

    @Column(nullable = false)
    private int ignorados;

    @Column(name = "com_erro", nullable = false)
    private int comErro;

    @Column(nullable = false, length = 30)
    private String situacao;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String configuracao;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String erros;

    protected Importacao() {
    }

    public Importacao(String destino, String nomeArquivo, UUID usuarioId, int linhas, int novos, int atualizados,
                      int ignorados, int comErro, String situacao, String configuracao, String erros) {
        this.destino = destino;
        this.nomeArquivo = nomeArquivo;
        this.usuarioId = usuarioId;
        this.linhas = linhas;
        this.novos = novos;
        this.atualizados = atualizados;
        this.ignorados = ignorados;
        this.comErro = comErro;
        this.situacao = situacao;
        this.configuracao = configuracao;
        this.erros = erros;
    }

    public UUID getId() {
        return id;
    }

    public String getDestino() {
        return destino;
    }

    public String getNomeArquivo() {
        return nomeArquivo;
    }

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public int getLinhas() {
        return linhas;
    }

    public int getNovos() {
        return novos;
    }

    public int getAtualizados() {
        return atualizados;
    }

    public int getIgnorados() {
        return ignorados;
    }

    public int getComErro() {
        return comErro;
    }

    public String getSituacao() {
        return situacao;
    }

    public String getConfiguracao() {
        return configuracao;
    }

    public String getErros() {
        return erros;
    }
}
