package br.com.treinos.api.treino;

import br.com.treinos.api.planos.VersaoBase;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.time.Instant;
import java.util.UUID;

/** Versão publicada (imutável) de um plano de treino. O registro do aluno aponta para ela. */
@Entity
@Immutable
@Table(name = "plano_treino_versao")
public class PlanoTreinoVersao extends VersaoBase {

    protected PlanoTreinoVersao() {
    }

    public PlanoTreinoVersao(PlanoTreino plano, int numero, String conteudo, UUID publicadoPor, Instant quando) {
        super(plano, numero, conteudo, publicadoPor, quando);
    }
}
