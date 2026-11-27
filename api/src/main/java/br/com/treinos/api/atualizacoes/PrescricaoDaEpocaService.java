package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.planos.PlanoServiceBase;
import br.com.treinos.api.planos.dto.PlanoDtos.VersaoDetalhe;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.PlanoTreinoService;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Prescrição da época da atualização, para a revisão do treinador: a versão do treino ou da dieta da pasta da atualização que
 * o aluno via em {@code enviada_em} ({@link PlanoServiceBase#versaoDaPastaEm}); sem envio, a de agora. Só leitura. A
 * atualização é buscada pelo {@code @TenantId} (outra consultoria = 404) e os planos, só do aluno e da pasta dela.
 */
@Service
public class PrescricaoDaEpocaService {

    /** {@code referencia} = o instante usado ({@code enviada_em}, ou agora sem envio); {@code versao} nula = nada publicado até lá. */
    public record Prescricao<C>(Instant referencia, VersaoDetalhe<C> versao) {
    }

    private final AtualizacaoRepository atualizacoes;
    private final PlanoTreinoService treinos;
    private final PlanoDietaService dietas;

    public PrescricaoDaEpocaService(AtualizacaoRepository atualizacoes, PlanoTreinoService treinos, PlanoDietaService dietas) {
        this.atualizacoes = atualizacoes;
        this.treinos = treinos;
        this.dietas = dietas;
    }

    @Transactional(readOnly = true)
    public Prescricao<ConteudoTreino> treino(UUID atualizacaoId) {
        return da(atualizacaoId, treinos);
    }

    @Transactional(readOnly = true)
    public Prescricao<ConteudoDieta> dieta(UUID atualizacaoId) {
        return da(atualizacaoId, dietas);
    }

    private <C> Prescricao<C> da(UUID atualizacaoId, PlanoServiceBase<?, ?, C> planos) {
        Atualizacao a = atualizacoes.findById(atualizacaoId)
                .orElseThrow(() -> new NaoEncontradoException("Atualização não encontrada."));
        Instant referencia = a.getEnviadaEm() != null ? a.getEnviadaEm() : Instant.now();
        // sem pasta não há prescrição; findByPastaId(null) viraria "pasta_id is null" e traria os planos soltos do aluno
        if (a.getPastaId() == null) {
            return new Prescricao<>(referencia, null);
        }
        return new Prescricao<>(referencia, planos.versaoDaPastaEm(a.getAlunoId(), a.getPastaId(), referencia).orElse(null));
    }
}
