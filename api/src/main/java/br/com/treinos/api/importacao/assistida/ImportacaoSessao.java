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
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * Sessão de importação assistida de lote misto (PDF, DOCX, planilhas e texto livre).
 * Os dados intermediários vivem em JSONB e expiram automaticamente em 7 dias.
 */
@Entity
@Table(name = "importacao_sessao")
public class ImportacaoSessao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "criado_por", nullable = false, updatable = false)
    private UUID criadoPor;

    @Column(nullable = false, length = 40)
    private String objetivo;

    @Column(nullable = false, length = 32)
    private String estado;

    @Column(nullable = false)
    private int revisao;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "progresso_json", nullable = false, columnDefinition = "jsonb")
    private String progressoJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "grupos_json", nullable = false, columnDefinition = "jsonb")
    private String gruposJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "duvidas_json", nullable = false, columnDefinition = "jsonb")
    private String duvidasJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "respostas_json", nullable = false, columnDefinition = "jsonb")
    private String respostasJson;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    @Column(name = "expira_em", nullable = false)
    private Instant expiraEm;

    protected ImportacaoSessao() {
    }

    public ImportacaoSessao(UUID criadoPor, String objetivo) {
        this.criadoPor = criadoPor;
        this.objetivo = objetivo != null && !objetivo.isBlank() ? objetivo : "CADASTROS_E_PLANOS_ATUAIS";
        this.estado = "RECEBENDO";
        this.revisao = 1;
        this.progressoJson = "{}";
        this.gruposJson = "[]";
        this.duvidasJson = "[]";
        this.respostasJson = "[]";
        Instant agora = Instant.now();
        this.criadoEm = agora;
        this.atualizadoEm = agora;
        this.expiraEm = agora.plus(7, ChronoUnit.DAYS);
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public UUID getCriadoPor() {
        return criadoPor;
    }

    public String getObjetivo() {
        return objetivo;
    }

    public String getEstado() {
        return estado;
    }

    public int getRevisao() {
        return revisao;
    }

    public String getProgressoJson() {
        return progressoJson;
    }

    public String getGruposJson() {
        return gruposJson;
    }

    public String getDuvidasJson() {
        return duvidasJson;
    }

    public String getRespostasJson() {
        return respostasJson;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
    }

    public Instant getExpiraEm() {
        return expiraEm;
    }

    public void atualizarEstado(String novoEstado) {
        this.estado = novoEstado;
        this.atualizadoEm = Instant.now();
    }

    public void atualizarResultados(String gruposJson, String duvidasJson, String progressoJson) {
        if (gruposJson != null) this.gruposJson = gruposJson;
        if (duvidasJson != null) this.duvidasJson = duvidasJson;
        if (progressoJson != null) this.progressoJson = progressoJson;
        this.atualizadoEm = Instant.now();
    }

    public void aplicarRespostas(String respostasJson, String gruposJson, String duvidasJson) {
        if (respostasJson != null) this.respostasJson = respostasJson;
        if (gruposJson != null) this.gruposJson = gruposJson;
        if (duvidasJson != null) this.duvidasJson = duvidasJson;
        this.revisao++;
        this.atualizadoEm = Instant.now();
    }

    public void incrementarRevisao() {
        this.revisao++;
        this.atualizadoEm = Instant.now();
    }

    @Override
    public String toString() {
        return "ImportacaoSessao[id=" + id + ", estado=" + estado + ", revisao=" + revisao + "]";
    }
}
