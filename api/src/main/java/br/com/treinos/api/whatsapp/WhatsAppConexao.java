package br.com.treinos.api.whatsapp;

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
 * A conexão da consultoria com a Cloud API da Meta: o número ({@code phone_number_id}), a conta ({@code waba_id}) e o token de
 * acesso cifrado por {@link CifraDoWhatsApp}. O token nunca volta em resposta, log, auditoria ou {@code toString}.
 */
@Entity
@Table(name = "whatsapp_conexao")
public class WhatsAppConexao {

    public static final String PROVEDOR = "META";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false, updatable = false)
    private String provedor;
    @Column(name = "phone_number_id", nullable = false)
    private String phoneNumberId;
    @Column(name = "waba_id", nullable = false)
    private String wabaId;
    @Column(name = "token_cifrado", nullable = false)
    private String tokenCifrado;
    @Column(name = "token_gravado_em", nullable = false)
    private Instant tokenGravadoEm;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;
    @Version
    private Long versao;

    protected WhatsAppConexao() {
    }

    WhatsAppConexao(String phoneNumberId, String wabaId, String tokenCifrado, Instant agora) {
        this.provedor = PROVEDOR;
        this.phoneNumberId = phoneNumberId;
        this.wabaId = wabaId;
        this.tokenCifrado = tokenCifrado;
        this.tokenGravadoEm = agora;
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    /** Número e conta novos; {@code tokenCifrado} nulo mantém o token gravado (e a data dele). */
    void alterar(String phoneNumberId, String wabaId, String tokenCifrado, Instant agora) {
        this.phoneNumberId = phoneNumberId;
        this.wabaId = wabaId;
        if (tokenCifrado != null) {
            this.tokenCifrado = tokenCifrado;
            this.tokenGravadoEm = agora;
        }
        this.atualizadoEm = agora;
    }

    public UUID getId() { return id; }
    public String getPhoneNumberId() { return phoneNumberId; }
    public String getWabaId() { return wabaId; }
    public String getTokenCifrado() { return tokenCifrado; }
    public Instant getTokenGravadoEm() { return tokenGravadoEm; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "WhatsAppConexao[" + id + "]";
    }
}
