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
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.TenantId;
import org.hibernate.generator.EventType;

import java.time.Instant;
import java.util.UUID;

/**
 * O que o treinador vende (não é o plano de treino nem o plano da Central). Editar o plano não muda quem já contratou: a
 * contratação guarda o próprio valor e a própria periodicidade. Nome único entre os não arquivados.
 */
@Entity
@Table(name = "plano_comercial")
public class PlanoComercial {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false)
    private String nome;
    @Column(name = "valor_centavos", nullable = false)
    private long valorCentavos;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PeriodoDoPlano periodicidade;
    @Column(name = "aceita_pix", nullable = false)
    private boolean aceitaPix;
    @Column(name = "aceita_boleto", nullable = false)
    private boolean aceitaBoleto;
    @Column(name = "aceita_cartao", nullable = false)
    private boolean aceitaCartao;
    @Column(name = "aceita_manual", nullable = false)
    private boolean aceitaManual;
    @Column(name = "max_parcelas", nullable = false)
    private int maxParcelas;
    @Enumerated(EnumType.STRING)
    @Column(name = "taxa_cartao", nullable = false)
    private TaxaDoCartao taxaCartao;
    @Column(name = "arquivado_em")
    private Instant arquivadoEm;
    /** Do {@code default now()} da coluna; o Hibernate lê de volta no insert, para a resposta de criação já trazer. */
    @Generated(event = EventType.INSERT)
    @Column(name = "criado_em", insertable = false, updatable = false)
    private Instant criadoEm;
    @Version
    private Long versao;

    protected PlanoComercial() {
    }

    PlanoComercial(String nome, long valorCentavos, PeriodoDoPlano periodicidade) {
        this.nome = nome;
        this.valorCentavos = valorCentavos;
        this.periodicidade = periodicidade;
    }

    void alterar(String nome, long valorCentavos, PeriodoDoPlano periodicidade, boolean aceitaPix, boolean aceitaBoleto,
                 boolean aceitaCartao, boolean aceitaManual, int maxParcelas, TaxaDoCartao taxaCartao) {
        this.nome = nome;
        this.valorCentavos = valorCentavos;
        this.periodicidade = periodicidade;
        this.aceitaPix = aceitaPix;
        this.aceitaBoleto = aceitaBoleto;
        this.aceitaCartao = aceitaCartao;
        this.aceitaManual = aceitaManual;
        this.maxParcelas = maxParcelas;
        this.taxaCartao = taxaCartao;
    }

    void arquivar(Instant quando) {
        this.arquivadoEm = quando;
    }

    public boolean isArquivado() {
        return arquivadoEm != null;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getNome() { return nome; }
    public long getValorCentavos() { return valorCentavos; }
    public PeriodoDoPlano getPeriodicidade() { return periodicidade; }
    public boolean isAceitaPix() { return aceitaPix; }
    public boolean isAceitaBoleto() { return aceitaBoleto; }
    public boolean isAceitaCartao() { return aceitaCartao; }
    public boolean isAceitaManual() { return aceitaManual; }
    public int getMaxParcelas() { return maxParcelas; }
    public TaxaDoCartao getTaxaCartao() { return taxaCartao; }
    public Instant getArquivadoEm() { return arquivadoEm; }
    public Instant getCriadoEm() { return criadoEm; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "PlanoComercial[" + id + "]";
    }
}
