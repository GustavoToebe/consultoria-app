package br.com.treinos.api.alunos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Aluno de uma consultoria. "Ativo" é decisão do treinador e base da futura cobrança; não depende de login.
 * {@code observacoes} e {@code objetivo} podem ter dado de saúde: nunca em log.
 */
@Entity
@Table(name = "aluno")
public class Aluno {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String nome;

    private String email;

    private String objetivo;

    private String observacoes;

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(name = "inativado_em")
    private Instant inativadoEm;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "convite_hash", length = 64)
    private String conviteHash;

    @Column(name = "convite_expira_em")
    private Instant conviteExpiraEm;

    @Column(name = "usuario_id")
    private UUID usuarioId;

    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm = Instant.now();

    @Version
    private Long versao;

    protected Aluno() {
    }

    public Aluno(String nome, String email, String objetivo, String observacoes) {
        this.nome = nome;
        this.email = email;
        this.objetivo = objetivo;
        this.observacoes = observacoes;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultoriaId() {
        return consultoriaId;
    }

    public String getNome() {
        return nome;
    }

    public String getEmail() {
        return email;
    }

    public String getObjetivo() {
        return objetivo;
    }

    public String getObservacoes() {
        return observacoes;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public Instant getInativadoEm() {
        return inativadoEm;
    }

    public String getConviteHash() {
        return conviteHash;
    }

    public Instant getConviteExpiraEm() {
        return conviteExpiraEm;
    }

    public UUID getUsuarioId() {
        return usuarioId;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
    }

    public Long getVersao() {
        return versao;
    }

    public void alterarDados(String nome, String email, String objetivo, String observacoes) {
        this.nome = nome;
        this.email = email;
        this.objetivo = objetivo;
        this.observacoes = observacoes;
        this.atualizadoEm = Instant.now();
    }

    public void alterarSituacao(boolean ativo, Instant quando) {
        this.ativo = ativo;
        this.inativadoEm = ativo ? null : quando;
        this.atualizadoEm = quando;
    }

    public void novoConvite(String hash, Instant expiraEm) {
        this.conviteHash = hash;
        this.conviteExpiraEm = expiraEm;
    }

    /** Convite aceito: liga o usuário e consome o código (não serve de novo). */
    public void ligarUsuario(UUID usuarioId) {
        this.usuarioId = usuarioId;
        this.conviteHash = null;
        this.conviteExpiraEm = null;
        this.atualizadoEm = Instant.now();
    }
}
