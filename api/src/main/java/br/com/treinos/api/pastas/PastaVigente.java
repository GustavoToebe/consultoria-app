package br.com.treinos.api.pastas;

import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Pasta vigente do aluno: a do treino ativo ou, sem treino ativo, a da dieta ativa; precisa ser do aluno, não estar
 * arquivada e ter fim. É a regra da atualização e da frequência na ficha (uma só, para as duas não divergirem).
 * Já filtrado pela consultoria ({@code @TenantId}).
 */
@Component
public class PastaVigente {

    private final PlanoTreinoRepository treinos;
    private final PlanoDietaRepository dietas;
    private final PastaRepository pastas;

    public PastaVigente(PlanoTreinoRepository treinos, PlanoDietaRepository dietas, PastaRepository pastas) {
        this.treinos = treinos;
        this.dietas = dietas;
        this.pastas = pastas;
    }

    public Optional<PastaPlano> de(UUID alunoId) {
        return treinos.findByAlunoIdAndAtivoTrue(alunoId).map(p -> p.getPastaId())
                .or(() -> dietas.findByAlunoIdAndAtivoTrue(alunoId).map(p -> p.getPastaId()))
                .flatMap(pastas::findById)
                .filter(p -> !p.isArquivado() && p.getFim() != null && p.getAlunoId().equals(alunoId));
    }
}
