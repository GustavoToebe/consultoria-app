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
 * Como o treinador recebe pelo provedor (hoje a InfinitePay): a conta (InfiniteTag, sem o {@code $}) e, opcional, a API Key
 * cifrada por {@link CifraDePagamento}. O {@code tokenAviso} é aleatório, vai no caminho do webhook e nasce com a
 * credencial: não muda nas alterações. Nada daqui vai a log, auditoria ou resposta além da conta; {@code toString} só traz o id.
 */
@Entity
@Table(name = "credencial_pagamento")
public class CredencialPagamento {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false, updatable = false)
    private String provedor;
    @Column(nullable = false)
    private String conta;
    @Column(name = "segredo_cifrado")
    private String segredoCifrado;
    @Enumerated(EnumType.STRING)
    @Column(name = "juros_parcelamento", nullable = false)
    private JurosDoParcelamento jurosDoParcelamento;
    @Column(name = "token_aviso", nullable = false, updatable = false)
    private String tokenAviso;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;
    @Version
    private Long versao;

    protected CredencialPagamento() {
    }

    CredencialPagamento(String provedor, String conta, String segredoCifrado, JurosDoParcelamento juros, String tokenAviso,
                        Instant agora) {
        this.provedor = provedor;
        this.conta = conta;
        this.segredoCifrado = segredoCifrado;
        this.jurosDoParcelamento = juros;
        this.tokenAviso = tokenAviso;
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    void alterar(String conta, String segredoCifrado, JurosDoParcelamento juros, Instant agora) {
        this.conta = conta;
        this.segredoCifrado = segredoCifrado;
        this.jurosDoParcelamento = juros;
        this.atualizadoEm = agora;
    }

    public UUID getId() { return id; }
    public UUID getConsultoriaId() { return consultoriaId; }
    public String getProvedor() { return provedor; }
    public String getConta() { return conta; }
    public String getSegredoCifrado() { return segredoCifrado; }
    public JurosDoParcelamento getJurosDoParcelamento() { return jurosDoParcelamento; }
    public String getTokenAviso() { return tokenAviso; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getAtualizadoEm() { return atualizadoEm; }
    public Long getVersao() { return versao; }

    @Override
    public String toString() {
        return "CredencialPagamento[" + id + "]";
    }
}
