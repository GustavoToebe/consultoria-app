package br.com.treinos.api.pagamentos;

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

/** Os lembretes de cobrança por e-mail da consultoria (uma linha por consultoria; sem linha = desligados, com os padrões). */
@Entity
@Table(name = "lembrete_configuracao")
public class ConfiguracaoDeLembretes {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false)
    private boolean ligado;
    @Column(name = "dias_antes", nullable = false)
    private int diasAntes;
    @Column(name = "no_dia", nullable = false)
    private boolean noDia;
    @Column(name = "dias_depois", nullable = false)
    private int diasDepois;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;
    @Version
    private Long versao;

    protected ConfiguracaoDeLembretes() {
    }

    ConfiguracaoDeLembretes(RegraDosLembretes.Configuracao c, Instant agora) {
        aplicar(c);
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    /** Devolve se algo mudou. */
    boolean alterar(RegraDosLembretes.Configuracao c, Instant agora) {
        if (c.equals(configuracao())) {
            return false;
        }
        aplicar(c);
        this.atualizadoEm = agora;
        return true;
    }

    private void aplicar(RegraDosLembretes.Configuracao c) {
        this.ligado = c.ligado();
        this.diasAntes = c.diasAntes();
        this.noDia = c.noDia();
        this.diasDepois = c.diasDepois();
    }

    RegraDosLembretes.Configuracao configuracao() {
        return new RegraDosLembretes.Configuracao(ligado, diasAntes, noDia, diasDepois);
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "ConfiguracaoDeLembretes[" + id + "]";
    }
}
