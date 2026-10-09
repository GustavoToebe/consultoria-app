package br.com.treinos.api.mobilidade;

import br.com.treinos.api.planos.VersaoBase;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.UUID;

/** Versão publicada (imutável) de um plano de mobilidade. */
@Entity
@Immutable
@Table(name = "plano_mobilidade_versao")
public class PlanoMobilidadeVersao extends VersaoBase {

    protected PlanoMobilidadeVersao() {
    }

    public PlanoMobilidadeVersao(PlanoMobilidade plano, int numero, String conteudo, UUID publicadoPor, Instant quando) {
        super(plano, numero, conteudo, publicadoPor, quando);
    }
}
