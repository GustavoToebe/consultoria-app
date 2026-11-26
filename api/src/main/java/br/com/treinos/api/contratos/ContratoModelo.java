package br.com.treinos.api.contratos;

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
 * Modelo de contrato da consultoria (V105, D4a): o texto com campos entre chaves, conferidos contra a lista fechada
 * ({@link CamposDoContrato}). Nunca se apaga, só se arquiva. O texto é jurídico: nunca em log.
 */
@Entity
@Table(name = "contrato_modelo")
public class ContratoModelo {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;
    @Column(nullable = false, length = 80)
    private String nome;
    @Column(nullable = false, columnDefinition = "text")
    private String texto;
    @Column(name = "arquivado_em")
    private Instant arquivadoEm;
    @Version
    private Long versao;
    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;
    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    protected ContratoModelo() {
    }

    ContratoModelo(String nome, String texto, Instant agora) {
        this.nome = nome;
        this.texto = texto;
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    /** Devolve se algo mudou; só então {@code atualizadoEm} anda. */
    boolean alterar(String nome, String texto, Instant agora) {
        boolean mudou = !this.nome.equals(nome) || !this.texto.equals(texto);
        this.nome = nome;
        this.texto = texto;
        if (mudou) {
            this.atualizadoEm = agora;
        }
        return mudou;
    }

    void arquivar(Instant agora) {
        this.arquivadoEm = agora;
        this.atualizadoEm = agora;
    }

    public boolean isArquivado() {
        return arquivadoEm != null;
    }

    public UUID getId() { return id; }
    public String getNome() { return nome; }
    public String getTexto() { return texto; }
    public Instant getArquivadoEm() { return arquivadoEm; }
    public Long getVersao() { return versao; }
    public Instant getAtualizadoEm() { return atualizadoEm; }

    @Override
    public String toString() {
        return "ContratoModelo[" + id + "]";
    }
}
