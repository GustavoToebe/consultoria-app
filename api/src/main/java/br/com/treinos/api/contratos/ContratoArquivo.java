package br.com.treinos.api.contratos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

import java.util.UUID;

/** Os bytes do PDF próprio (V105, D14), 1:1 com o contrato de origem PDF. Nunca em log nem em {@code toString}. */
@Entity
@Table(name = "contrato_arquivo")
public class ContratoArquivo {

    @Id
    @Column(name = "contrato_id", nullable = false, updatable = false)
    private UUID contratoId;

    @TenantId
    @Column(name = "consultoria_id", nullable = false, updatable = false)
    private UUID consultoriaId;

    @Column(nullable = false, updatable = false)
    private byte[] bytes;

    protected ContratoArquivo() {
    }

    ContratoArquivo(UUID contratoId, byte[] bytes) {
        this.contratoId = contratoId;
        this.bytes = bytes.clone();
    }

    byte[] getBytes() { return bytes.clone(); }

    @Override
    public String toString() {
        return "ContratoArquivo[" + contratoId + "]";
    }
}
