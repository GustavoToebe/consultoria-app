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
import org.hibernate.annotations.TenantId;

import java.time.Instant;
import java.util.UUID;

/**
 * Subconta Asaas da consultoria (Overtraining Pay, V100). Uma por consultoria.
 * API Key, tokens do webhook e documento são cifrados via {@link CifraDePagamento} com {@code consultoriaId} no AAD;
 * apenas versões mascaradas ficam em claro. {@code toString()} nunca expõe dados pessoais ou segredos.
 */
@Entity
@Table(name = "subconta_asaas")
public class SubcontaAsaas {

    public enum TipoPessoa { PF, PJ }

    public enum TipoConta { CORRENTE, POUPANCA, PAGAMENTO }

    public enum Situacao { NAO_CONFIGURADA, DOCUMENTOS_PENDENTES, PRONTA_PARA_TESTE, ATIVA, REJEITADA }

    public enum SituacaoCobrancaTeste { CRIADA, PAGA, HOMOLOGADA }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(name = "asaas_conta_id", length = 60)
    private String asaasContaId;

    @Column(name = "wallet_id", length = 64)
    private String walletId;

    @Column(name = "api_key_cifrada")
    private String apiKeyCifrada;

    @Column(name = "token_caminho", nullable = false, updatable = false, length = 64)
    private String tokenCaminho;

    @Column(name = "token_webhook_cifrado", nullable = false)
    private String tokenWebhookCifrado;

    @Column(name = "token_webhook_anterior_cifrado")
    private String tokenWebhookAnteriorCifrado;

    @Column(name = "anterior_valido_ate")
    private Instant anteriorValidoAte;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_pessoa", nullable = false, length = 2)
    private TipoPessoa tipoPessoa;

    @Column(name = "documento_cifrado", nullable = false)
    private String documentoCifrado;

    @Column(name = "documento_mascarado", nullable = false, length = 20)
    private String documentoMascarado;

    @Column(name = "nome_titular", nullable = false, length = 120)
    private String nomeTitular;

    @Column(name = "email_financeiro", nullable = false, length = 160)
    private String emailFinanceiro;

    @Column(name = "telefone_mascarado", length = 24)
    private String telefoneMascarado;

    @Column(name = "cep", length = 10)
    private String cep;

    @Column(name = "endereco_resumo", length = 200)
    private String enderecoResumo;

    @Column(name = "renda_mensal_centavos")
    private Long rendaMensalCentavos;

    @Column(name = "banco_codigo", nullable = false, length = 10)
    private String bancoCodigo;

    @Column(name = "banco_nome", nullable = false, length = 80)
    private String bancoNome;

    @Column(name = "agencia_mascarada", nullable = false, length = 12)
    private String agenciaMascarada;

    @Column(name = "conta_mascarada", nullable = false, length = 20)
    private String contaMascarada;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_conta", nullable = false, length = 20)
    private TipoConta tipoConta;

    @Column(name = "repasse_automatico", nullable = false)
    private boolean repasseAutomatico;

    @Enumerated(EnumType.STRING)
    @Column(name = "situacao", nullable = false, length = 25)
    private Situacao situacao;

    @Column(name = "onboarding_url", length = 500)
    private String onboardingUrl;

    @Column(name = "cobranca_teste_id", length = 60)
    private String cobrancaTesteId;

    @Enumerated(EnumType.STRING)
    @Column(name = "cobranca_teste_situacao", length = 20)
    private SituacaoCobrancaTeste cobrancaTesteSituacao;

    @Column(name = "cobranca_teste_qr_base64")
    private String cobrancaTesteQrBase64;

    @Column(name = "cobranca_teste_copia_cola")
    private String cobrancaTesteCopiaCola;

    @Column(name = "cobranca_teste_expira_em")
    private Instant cobrancaTesteExpiraEm;

    @Column(name = "homologada_em")
    private Instant homologadaEm;

    @Version
    private Long versao;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    protected SubcontaAsaas() {
    }

    SubcontaAsaas(String asaasContaId, String walletId, String apiKeyCifrada, String tokenCaminho,
                  String tokenWebhookCifrado, TipoPessoa tipoPessoa, String documentoCifrado,
                  String documentoMascarado, String nomeTitular, String emailFinanceiro, String telefoneMascarado,
                  String cep, String enderecoResumo, Long rendaMensalCentavos, String bancoCodigo, String bancoNome,
                  String agenciaMascarada, String contaMascarada, TipoConta tipoConta, boolean repasseAutomatico,
                  Situacao situacao, String onboardingUrl,
                  Instant agora) {
        this.asaasContaId = asaasContaId;
        this.walletId = walletId;
        this.apiKeyCifrada = apiKeyCifrada;
        this.tokenCaminho = tokenCaminho;
        this.tokenWebhookCifrado = tokenWebhookCifrado;
        this.tipoPessoa = tipoPessoa;
        this.documentoCifrado = documentoCifrado;
        this.documentoMascarado = documentoMascarado;
        this.nomeTitular = nomeTitular;
        this.emailFinanceiro = emailFinanceiro;
        this.telefoneMascarado = telefoneMascarado;
        this.cep = cep;
        this.enderecoResumo = enderecoResumo;
        this.rendaMensalCentavos = rendaMensalCentavos;
        this.bancoCodigo = bancoCodigo;
        this.bancoNome = bancoNome;
        this.agenciaMascarada = agenciaMascarada;
        this.contaMascarada = contaMascarada;
        this.tipoConta = tipoConta;
        this.repasseAutomatico = repasseAutomatico;
        this.situacao = situacao;
        this.onboardingUrl = onboardingUrl;
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    void atualizarDados(TipoPessoa tipoPessoa, String documentoCifrado, String documentoMascarado, String nomeTitular,
                        String emailFinanceiro, String telefoneMascarado, String cep, String enderecoResumo,
                        Long rendaMensalCentavos, String bancoCodigo, String bancoNome, String agenciaMascarada,
                        String contaMascarada, TipoConta tipoConta, boolean repasseAutomatico, Instant agora) {
        this.tipoPessoa = tipoPessoa;
        if (documentoCifrado != null) {
            this.documentoCifrado = documentoCifrado;
            this.documentoMascarado = documentoMascarado;
        }
        this.nomeTitular = nomeTitular;
        this.emailFinanceiro = emailFinanceiro;
        if (telefoneMascarado != null) {
            this.telefoneMascarado = telefoneMascarado;
        }
        if (cep != null) {
            this.cep = cep;
        }
        if (enderecoResumo != null) {
            this.enderecoResumo = enderecoResumo;
        }
        if (rendaMensalCentavos != null) {
            this.rendaMensalCentavos = rendaMensalCentavos;
        }
        this.bancoCodigo = bancoCodigo;
        this.bancoNome = bancoNome;
        if (agenciaMascarada != null) {
            this.agenciaMascarada = agenciaMascarada;
        }
        if (contaMascarada != null) {
            this.contaMascarada = contaMascarada;
        }
        this.tipoConta = tipoConta;
        this.repasseAutomatico = repasseAutomatico;
        this.atualizadoEm = agora;
    }

    void rotacionarWebhook(String novoTokenCifrado, Instant anteriorValidoAte, Instant agora) {
        this.tokenWebhookAnteriorCifrado = this.tokenWebhookCifrado;
        this.anteriorValidoAte = anteriorValidoAte;
        this.tokenWebhookCifrado = novoTokenCifrado;
        this.atualizadoEm = agora;
    }

    void atualizarStatusKyc(Situacao novaSituacao, String novaOnboardingUrl, Instant agora) {
        this.situacao = novaSituacao;
        this.onboardingUrl = novaOnboardingUrl;
        this.atualizadoEm = agora;
    }

    void registrarCobrancaTeste(String cobrancaId, String qrBase64, String copiaCola, Instant expiraEm, Instant agora) {
        this.cobrancaTesteId = cobrancaId;
        this.cobrancaTesteSituacao = SituacaoCobrancaTeste.CRIADA;
        this.cobrancaTesteQrBase64 = qrBase64;
        this.cobrancaTesteCopiaCola = copiaCola;
        this.cobrancaTesteExpiraEm = expiraEm;
        this.atualizadoEm = agora;
    }

    boolean homologar(Instant agora) {
        boolean mudou = this.situacao != Situacao.ATIVA || this.cobrancaTesteSituacao != SituacaoCobrancaTeste.HOMOLOGADA;
        this.cobrancaTesteSituacao = SituacaoCobrancaTeste.HOMOLOGADA;
        this.situacao = Situacao.ATIVA;
        if (this.homologadaEm == null) {
            this.homologadaEm = agora;
        }
        this.onboardingUrl = null;
        if (mudou) {
            this.atualizadoEm = agora;
        }
        return mudou;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getAsaasContaId() { return asaasContaId; }
    public String getWalletId() { return walletId; }
    public String getApiKeyCifrada() { return apiKeyCifrada; }
    public String getTokenCaminho() { return tokenCaminho; }
    public String getTokenWebhookCifrado() { return tokenWebhookCifrado; }
    public String getTokenWebhookAnteriorCifrado() { return tokenWebhookAnteriorCifrado; }
    public Instant getAnteriorValidoAte() { return anteriorValidoAte; }
    public TipoPessoa getTipoPessoa() { return tipoPessoa; }
    public String getDocumentoCifrado() { return documentoCifrado; }
    public String getDocumentoMascarado() { return documentoMascarado; }
    public String getNomeTitular() { return nomeTitular; }
    public String getEmailFinanceiro() { return emailFinanceiro; }
    public String getTelefoneMascarado() { return telefoneMascarado; }
    public String getCep() { return cep; }
    public String getEnderecoResumo() { return enderecoResumo; }
    public Long getRendaMensalCentavos() { return rendaMensalCentavos; }
    public String getBancoCodigo() { return bancoCodigo; }
    public String getBancoNome() { return bancoNome; }
    public String getAgenciaMascarada() { return agenciaMascarada; }
    public String getContaMascarada() { return contaMascarada; }
    public TipoConta getTipoConta() { return tipoConta; }
    public boolean isRepasseAutomatico() { return repasseAutomatico; }
    public Situacao getSituacao() { return situacao; }
    public String getOnboardingUrl() { return onboardingUrl; }
    public String getCobrancaTesteId() { return cobrancaTesteId; }
    public SituacaoCobrancaTeste getCobrancaTesteSituacao() { return cobrancaTesteSituacao; }
    public String getCobrancaTesteQrBase64() { return cobrancaTesteQrBase64; }
    public String getCobrancaTesteCopiaCola() { return cobrancaTesteCopiaCola; }
    public Instant getCobrancaTesteExpiraEm() { return cobrancaTesteExpiraEm; }
    public Instant getHomologadaEm() { return homologadaEm; }
    public Long getVersao() { return versao; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getAtualizadoEm() { return atualizadoEm; }

    @Override
    public String toString() {
        return "SubcontaAsaas[" + id + "]";
    }
}
