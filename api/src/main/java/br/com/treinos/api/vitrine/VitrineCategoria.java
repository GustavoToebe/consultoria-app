package br.com.treinos.api.vitrine;

import br.com.treinos.api.web.Buscas;
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
 * Categoria da vitrine (V099): agrupa itens da consultoria. O nome é texto digitado pelo treinador: nunca em log, auditoria nem
 * mensagem de erro. Chega já com strip e NFC; {@code nomeNormalizado} ({@link Buscas#semAcento}) é o que a unicidade confere.
 */
@Entity
@Table(name = "vitrine_categoria")
public class VitrineCategoria {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false, length = 40)
    private String nome;

    @Column(name = "nome_normalizado", nullable = false, length = 80)
    private String nomeNormalizado;

    @Column(nullable = false)
    private int ordem;

    @Version
    private Long versao;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm = Instant.now();

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm = criadoEm;

    protected VitrineCategoria() {
    }

    VitrineCategoria(String nome, int ordem) {
        this.nome = nome;
        this.nomeNormalizado = Buscas.semAcento(nome);
        this.ordem = ordem;
    }

    public UUID getId() { return id; }
    public String getNome() { return nome; }
    public String getNomeNormalizado() { return nomeNormalizado; }
    public int getOrdem() { return ordem; }

    /** Devolve se algo mudou; só então {@code atualizadoEm} anda (e a versão, pelo Hibernate). */
    boolean renomear(String novoNome) {
        if (nome.equals(novoNome)) {
            return false;
        }
        this.nome = novoNome;
        this.nomeNormalizado = Buscas.semAcento(novoNome);
        this.atualizadoEm = Instant.now();
        return true;
    }

    void ordenarEm(int ordem) {
        this.ordem = ordem;
        this.atualizadoEm = Instant.now();
    }

    @Override
    public String toString() {
        return "VitrineCategoria[" + id + "]";
    }
}
