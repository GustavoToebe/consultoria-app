package br.com.treinos.api.atualizacoes;
import jakarta.persistence.*;
import org.hibernate.annotations.TenantId;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Respostas sensíveis: nunca incluir conteúdo em logs, exceções ou toString. */
@Entity @Table(name = "atualizacao")
public class Atualizacao {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @TenantId @Column(name = "consultoria_id", nullable = false, updatable = false) private UUID consultoriaId;
    @Column(name = "aluno_id", nullable = false, updatable = false) private UUID alunoId;
    @Column(name = "pasta_id", nullable = false, updatable = false) private UUID pastaId;
    @Column(name = "data_atualizacao", nullable = false) private LocalDate dataAtualizacao;
    @Column(name = "modelo_versao", nullable = false) private int modeloVersao;
    @Column(nullable = false) private String estado;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false) private String respostas;
    @Column(name = "enviada_em") private Instant enviadaEm;
    @Column(name = "atraso_ate") private LocalDate atrasoAte;
    @Column(name = "atraso_motivo") private String atrasoMotivo;
    @Column(name = "atraso_avisado_em") private Instant atrasoAvisadoEm;
     private String feedback;
    @Column(name = "feedback_em") private Instant feedbackEm;
    @Column(name = "feedback_editado_em") private Instant feedbackEditadoEm;
    @Column(name = "feedback_por") private UUID feedbackPor;
    @Column(name = "feedback_visto_em") private Instant feedbackVistoEm;
    @Version private Long versao;
    protected Atualizacao() { }
    public Atualizacao(UUID alunoId, UUID pastaId, LocalDate data, int modeloVersao) {
        this.alunoId = alunoId; this.pastaId = pastaId; this.dataAtualizacao = data;
        this.modeloVersao = modeloVersao; this.estado = "ABERTA"; this.respostas = "{}";
    }
    public void enviar(String respostas, Instant quando) { this.respostas = respostas; this.enviadaEm = quando; this.estado = "ENVIADA"; }
    public void avisarAtraso(LocalDate data, String motivo, Instant quando) { this.atrasoAte = data; this.atrasoMotivo = motivo; this.atrasoAvisadoEm = quando; }
    public void responder(String texto, UUID usuarioId, Instant quando) {
        if (feedbackEm != null) feedbackEditadoEm = quando;
        else feedbackEm = quando;
        feedback = texto; feedbackPor = usuarioId; feedbackVistoEm = null; estado = "REVISADA";
    }
    public void marcarVisto(Instant quando) { if (feedbackEm != null && feedbackVistoEm == null) feedbackVistoEm = quando; }
    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public UUID getAlunoId() { return alunoId; }
    public UUID getPastaId() { return pastaId; }
    public LocalDate getDataAtualizacao() { return dataAtualizacao; }
    public int getModeloVersao() { return modeloVersao; }
    public String getEstado() { return estado; }
    public String getRespostas() { return respostas; }
    public Instant getEnviadaEm() { return enviadaEm; }
    public LocalDate getAtrasoAte() { return atrasoAte; }
    public String getAtrasoMotivo() { return atrasoMotivo; }
    public Instant getAtrasoAvisadoEm() { return atrasoAvisadoEm; }
    public String getFeedback() { return feedback; }
    public Instant getFeedbackEm() { return feedbackEm; }
    public Instant getFeedbackEditadoEm() { return feedbackEditadoEm; }
    public UUID getFeedbackPor() { return feedbackPor; }
    public Instant getFeedbackVistoEm() { return feedbackVistoEm; }
    public Long getVersao() { return versao; }
}
