package br.com.treinos.api.dieta;

import br.com.treinos.api.planos.VersaoBase;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.UUID;

/** Versão publicada (imutável) de um plano de dieta. */
@Entity
@Immutable
@Table(name = "plano_dieta_versao")
public class PlanoDietaVersao extends VersaoBase {

    protected PlanoDietaVersao() {
    }

    public PlanoDietaVersao(PlanoDieta plano, int numero, String conteudo, UUID publicadoPor, Instant quando) {
        super(plano, numero, conteudo, publicadoPor, quando);
    }
}
