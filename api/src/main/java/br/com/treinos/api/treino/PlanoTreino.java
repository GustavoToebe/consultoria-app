package br.com.treinos.api.treino;

import br.com.treinos.api.planos.PlanoBase;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

/** Plano de treino de um aluno (rascunho + versões publicadas em {@link PlanoTreinoVersao}). */
@Entity
@Table(name = "plano_treino")
public class PlanoTreino extends PlanoBase {

    protected PlanoTreino() {
    }

    public PlanoTreino(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        super(alunoId, titulo, inicio, fim, rascunho);
    }
}
