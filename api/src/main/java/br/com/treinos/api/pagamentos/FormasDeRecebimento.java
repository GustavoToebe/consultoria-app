package br.com.treinos.api.pagamentos;

import br.com.treinos.api.pagamentos.FormasDePagamentoDoAluno.Ligadas;
import br.com.treinos.api.pagamentos.FormasDePagamentoDoAluno.PixConfigurado;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * As formas de recebimento da consultoria (V087, {@code forma_de_recebimento}): uma linha por consultoria, criada na primeira
 * gravação (a chave primária é a própria consultoria). O Manual não tem coluna: está sempre ligado. A chave Pix fica em claro
 * porque vai dentro de todo código copia e cola, mas é dado pessoal: nunca em log, auditoria, mensagem de erro nem {@code toString}.
 */
@Entity
@Table(name = "forma_de_recebimento")
public class FormasDeRecebimento {

    // A chave primária é a própria consultoria (V087). O Hibernate não deixa o mesmo atributo ser @Id e @TenantId (persist vira
    // "detached"), então o id é atribuído pelo serviço a partir do TenantContext e o filtro de tenant lê a mesma coluna sem gravá-la.
    @Id
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, insertable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "infinite_pay", nullable = false)
    private boolean infinitePay;
    @Column(name = "link_proprio", nullable = false)
    private boolean linkProprio;
    @Column(nullable = false)
    private boolean pix;
    @Enumerated(EnumType.STRING)
    @Column(name = "pix_tipo_chave", length = 10)
    private ChavePix.Tipo pixTipoChave;
    @Column(name = "pix_chave", length = ChavePix.MAXIMO)
    private String pixChave;
    @Column(name = "pix_nome_recebedor", length = BrCodePix.NOME_MAXIMO)
    private String pixNomeRecebedor;
    @Column(name = "pix_cidade", length = BrCodePix.CIDADE_MAXIMO)
    private String pixCidade;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;
    @Version
    private Long versao;

    protected FormasDeRecebimento() {
    }

    /** {@code consultoriaId} é o da sessão ({@code TenantContext.get()}), nunca do corpo. */
    FormasDeRecebimento(UUID consultoriaId, Instant agora) {
        this.id = consultoriaId;
        this.consultoriaId = consultoriaId;
        this.infinitePay = true;
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    /** Os dados do Pix que o PUT grava (os quatro juntos, como o CHECK da tabela exige). */
    record DadosDoPix(ChavePix.Tipo tipo, String chave, String nomeRecebedor, String cidade) {
        @Override
        public String toString() {
            return "DadosDoPix[tipo=" + tipo + "]";
        }
    }

    /** {@code pixNovo} nulo mantém os dados do Pix que já estão gravados. Devolve se algo mudou. */
    boolean alterar(boolean infinitePay, boolean linkProprio, boolean pix, DadosDoPix pixNovo, Instant agora) {
        boolean mudou = this.infinitePay != infinitePay || this.linkProprio != linkProprio || this.pix != pix;
        this.infinitePay = infinitePay;
        this.linkProprio = linkProprio;
        this.pix = pix;
        if (pixNovo != null && !pixNovo.equals(dadosDoPix())) {
            this.pixTipoChave = pixNovo.tipo();
            this.pixChave = pixNovo.chave();
            this.pixNomeRecebedor = pixNovo.nomeRecebedor();
            this.pixCidade = pixNovo.cidade();
            mudou = true;
        }
        if (mudou) {
            this.atualizadoEm = agora;
        }
        return mudou;
    }

    /** D12: desliga o Pix e zera chave, tipo, nome e cidade juntos (o CHECK exige os quatro com o Pix ligado). Devolve se mudou algo. */
    boolean apagarPix(Instant agora) {
        boolean mudou = pix || pixChave != null || pixTipoChave != null || pixNomeRecebedor != null || pixCidade != null;
        this.pix = false;
        this.pixTipoChave = null;
        this.pixChave = null;
        this.pixNomeRecebedor = null;
        this.pixCidade = null;
        if (mudou) {
            this.atualizadoEm = agora;
        }
        return mudou;
    }

    DadosDoPix dadosDoPix() {
        return pixChave == null ? null : new DadosDoPix(pixTipoChave, pixChave, pixNomeRecebedor, pixCidade);
    }

    /** As formas como a regra do aluno as lê: Pix só vem se ligado e com os quatro campos. */
    Ligadas ligadas() {
        boolean completo = pixTipoChave != null && pixChave != null && pixNomeRecebedor != null && pixCidade != null;
        PixConfigurado configurado = pix && completo
                ? new PixConfigurado(pixTipoChave, pixChave, pixNomeRecebedor, pixCidade) : null;
        return new Ligadas(infinitePay, linkProprio, configurado);
    }

    public UUID getConsultoriaId() { return id; }
    public boolean isInfinitePay() { return infinitePay; }
    public boolean isLinkProprio() { return linkProprio; }
    public boolean isPix() { return pix; }
    public ChavePix.Tipo getPixTipoChave() { return pixTipoChave; }
    public String getPixNomeRecebedor() { return pixNomeRecebedor; }
    public String getPixCidade() { return pixCidade; }
    public Long getVersao() { return versao; }
    boolean temChave() { return pixChave != null; }
    String chaveMascarada() { return ChavePix.mascarar(pixTipoChave, pixChave); }

    @Override
    public boolean equals(Object o) {
        return o instanceof FormasDeRecebimento f && Objects.equals(id, f.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "FormasDeRecebimento[" + id + "]";
    }
}
