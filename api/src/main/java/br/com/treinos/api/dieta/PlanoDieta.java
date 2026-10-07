package br.com.treinos.api.dieta;

import br.com.treinos.api.planos.PlanoBase;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

/** Plano de dieta de um aluno (rascunho + versões publicadas em {@link PlanoDietaVersao}). */
@Entity
@Table(name = "plano_dieta")
public class PlanoDieta extends PlanoBase {

    protected PlanoDieta() {
    }

    public PlanoDieta(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        super(alunoId, titulo, inicio, fim, rascunho);
    }
}
