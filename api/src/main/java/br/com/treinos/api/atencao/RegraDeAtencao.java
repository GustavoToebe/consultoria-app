package br.com.treinos.api.atencao;

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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Regra de atenção da consultoria (V190): vale para todos os alunos que respondem um questionário com a pergunta. */
@Entity
@Table(name = "regra_de_atencao")
public class RegraDeAtencao {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 14, updatable = false)
    private TipoDeRegra tipo;
    @Column(name = "pergunta_id", length = 100)
    private String perguntaId;
    @Column(precision = 4, scale = 1)
    private BigDecimal limite;
    @Column(nullable = false)
    private boolean ativa;
    @Version
    private Long versao;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "alterado_em", nullable = false)
    private Instant alteradoEm;

    protected RegraDeAtencao() {
    }

    RegraDeAtencao(TipoDeRegra tipo, String perguntaId, BigDecimal limite, boolean ativa, Instant agora) {
        this.tipo = tipo;
        this.perguntaId = perguntaId;
        this.limite = limite;
        this.ativa = ativa;
        this.criadoEm = agora;
        this.alteradoEm = agora;
    }

    /** Devolve se algo mudou; só então {@code alteradoEm} anda (e a versão, pelo Hibernate). */
    boolean alterar(String novaPergunta, BigDecimal novoLimite, boolean novaAtiva, Instant agora) {
        boolean mudou = !Objects.equals(perguntaId, novaPergunta) || ativa != novaAtiva || !mesmoNumero(limite, novoLimite);
        if (mudou) {
            this.perguntaId = novaPergunta;
            this.limite = novoLimite;
            this.ativa = novaAtiva;
            this.alteradoEm = agora;
        }
        return mudou;
    }

    static boolean mesmoNumero(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    public UUID getId() { return id; }
    public TipoDeRegra getTipo() { return tipo; }
    public String getPerguntaId() { return perguntaId; }
    public BigDecimal getLimite() { return limite; }
    public boolean isAtiva() { return ativa; }
    public Long getVersao() { return versao; }
    public Instant getCriadoEm() { return criadoEm; }

    @Override
    public boolean equals(Object o) {
        return o instanceof RegraDeAtencao r && id != null && Objects.equals(id, r.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }
}
