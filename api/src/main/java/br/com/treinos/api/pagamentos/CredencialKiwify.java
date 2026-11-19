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

/**
 * A credencial da Kiwify da consultoria (uma só): token do webhook, {@code client_id}, {@code client_secret} e
 * {@code account_id}, os quatro cifrados por {@link CifraDePagamento} (nunca em claro). O {@code tokenCaminho} é aleatório,
 * vai no caminho do webhook público e nasce com a credencial: não muda nas alterações. Trocar o token do webhook guarda o
 * anterior por 24 h ({@code anteriorValidoAte}). Nada daqui vai a log, auditoria ou resposta; {@code toString} só traz o id.
 */
@Entity
@Table(name = "credencial_kiwify")
public class CredencialKiwify {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(name = "token_webhook_cifrado", nullable = false)
    private String tokenWebhookCifrado;
    @Column(name = "client_id_cifrado", nullable = false)
    private String clientIdCifrado;
    @Column(name = "client_secret_cifrado", nullable = false)
    private String clientSecretCifrado;
    @Column(name = "account_id_cifrado", nullable = false)
    private String accountIdCifrado;
    @Column(name = "token_caminho", nullable = false, updatable = false)
    private String tokenCaminho;
    @Column(name = "token_webhook_anterior_cifrado")
    private String tokenWebhookAnteriorCifrado;
    @Column(name = "anterior_valido_ate")
    private Instant anteriorValidoAte;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;
    @Version
    private Long versao;

    protected CredencialKiwify() {
    }

    CredencialKiwify(String tokenWebhookCifrado, String clientIdCifrado, String clientSecretCifrado, String accountIdCifrado,
                     String tokenCaminho, Instant agora) {
        this.tokenWebhookCifrado = tokenWebhookCifrado;
        this.clientIdCifrado = clientIdCifrado;
        this.clientSecretCifrado = clientSecretCifrado;
        this.accountIdCifrado = accountIdCifrado;
        this.tokenCaminho = tokenCaminho;
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    /** Campo nulo mantém o gravado. Token novo do webhook: o atual vira o anterior, válido até {@code anteriorValidoAte}. */
    void alterar(String tokenWebhookNovo, String clientId, String clientSecret, String accountId, Instant anteriorValidoAte,
                 Instant agora) {
        if (tokenWebhookNovo != null) {
            this.tokenWebhookAnteriorCifrado = this.tokenWebhookCifrado;
            this.anteriorValidoAte = anteriorValidoAte;
            this.tokenWebhookCifrado = tokenWebhookNovo;
        }
        if (clientId != null) {
            this.clientIdCifrado = clientId;
        }
        if (clientSecret != null) {
            this.clientSecretCifrado = clientSecret;
        }
        if (accountId != null) {
            this.accountIdCifrado = accountId;
        }
        this.atualizadoEm = agora;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getTokenWebhookCifrado() { return tokenWebhookCifrado; }
    public String getClientIdCifrado() { return clientIdCifrado; }
    public String getClientSecretCifrado() { return clientSecretCifrado; }
    public String getAccountIdCifrado() { return accountIdCifrado; }
    public String getTokenCaminho() { return tokenCaminho; }
    public String getTokenWebhookAnteriorCifrado() { return tokenWebhookAnteriorCifrado; }
    public Instant getAnteriorValidoAte() { return anteriorValidoAte; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getAtualizadoEm() { return atualizadoEm; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "CredencialKiwify[" + id + "]";
    }
}
