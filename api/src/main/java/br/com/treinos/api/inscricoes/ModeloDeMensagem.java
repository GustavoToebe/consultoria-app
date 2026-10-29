package br.com.treinos.api.inscricoes;

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
 * Resposta pronta para o WhatsApp da consultoria (V045). Variáveis {@code {primeiro_nome}}, {@code {consultoria}} e
 * {@code {plano}}, trocadas no app; o texto final nunca volta para a API. Toda consultoria nasce com quatro (gatilho).
 */
@Entity
@Table(name = "inscricao_modelo_mensagem")
public class ModeloDeMensagem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private String texto;

    @Column(nullable = false)
    private int ordem;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm = criadoEm;

    @Version
    private Long versao;

    protected ModeloDeMensagem() {
    }

    ModeloDeMensagem(String nome, String texto, int ordem) {
        alterar(nome, texto, ordem);
    }

    public UUID getId() { return id; }
    public String getNome() { return nome; }
    public String getTexto() { return texto; }
    public int getOrdem() { return ordem; }
    public Long getVersao() { return versao; }

    void alterar(String nome, String texto, int ordem) {
        this.nome = nome;
        this.texto = texto;
        this.ordem = ordem;
        this.atualizadoEm = Instant.now();
    }
}
