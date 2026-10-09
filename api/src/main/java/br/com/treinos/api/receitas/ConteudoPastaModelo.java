package br.com.treinos.api.receitas;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.dieta.ConteudoDieta;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record ConteudoPastaModelo(@NotNull @Size(max = 30) List<@NotNull @Valid Plano> planos) {
    public record Plano(@NotBlank @Size(max = 120) String titulo, @Valid ConteudoTreino treino,
                        @Valid ConteudoDieta dieta, @Valid ConteudoMobilidade mobilidade) {
        /** Quantos dos três conteúdos vieram preenchidos; o pacote exige exatamente um por plano. */
        public int tipos() {
            return (treino != null ? 1 : 0) + (dieta != null ? 1 : 0) + (mobilidade != null ? 1 : 0);
        }
    }
}
