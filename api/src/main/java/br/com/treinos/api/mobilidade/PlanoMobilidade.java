package br.com.treinos.api.mobilidade;

import br.com.treinos.api.planos.PlanoBase;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

/** Plano de mobilidade de um aluno (rascunho + versões publicadas em {@link PlanoMobilidadeVersao}). */
@Entity
@Table(name = "plano_mobilidade")
public class PlanoMobilidade extends PlanoBase {

    protected PlanoMobilidade() {
    }

    public PlanoMobilidade(UUID alunoId, String titulo, LocalDate inicio, LocalDate fim, String rascunho) {
        super(alunoId, titulo, inicio, fim, rascunho);
    }
}
