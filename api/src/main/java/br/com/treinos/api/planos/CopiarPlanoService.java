package br.com.treinos.api.planos;

import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.mobilidade.PlanoMobilidadeService;
import br.com.treinos.api.pastas.PastaDtos.PastaRequest;
import br.com.treinos.api.pastas.PastaService;
import br.com.treinos.api.planos.dto.PlanoDtos.CopiaResposta;
import br.com.treinos.api.planos.dto.PlanoDtos.CopiarPlanoRequest;
import br.com.treinos.api.treino.PlanoTreinoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Copia um plano (treino, dieta ou mobilidade) para outro aluno, num rascunho dentro de uma pasta do destino, existente
 * ou criada aqui. Fica fora dos serviços de plano porque a pasta depende deles. A permissão de alterar o tipo vem da
 * rota; aqui entra a de criar pasta (só quando a pasta é nova). Tudo é conferido antes de criar qualquer coisa, e numa
 * transação só: se a cópia falhar, a pasta nova não fica.
 */
@Service
public class CopiarPlanoService {

    private final PastaService pastas;
    private final PlanoTreinoService treinos;
    private final PlanoDietaService dietas;
    private final PlanoMobilidadeService mobilidades;

    public CopiarPlanoService(PastaService pastas, PlanoTreinoService treinos, PlanoDietaService dietas,
                              PlanoMobilidadeService mobilidades) {
        this.pastas = pastas;
        this.treinos = treinos;
        this.dietas = dietas;
        this.mobilidades = mobilidades;
    }

    @Transactional
    public CopiaResposta treino(UUID origemId, CopiarPlanoRequest r) {
        return copiar(treinos, origemId, r);
    }

    @Transactional
    public CopiaResposta dieta(UUID origemId, CopiarPlanoRequest r) {
        return copiar(dietas, origemId, r);
    }

    @Transactional
    public CopiaResposta mobilidade(UUID origemId, CopiarPlanoRequest r) {
        return copiar(mobilidades, origemId, r);
    }

    private CopiaResposta copiar(PlanoServiceBase<?, ?, ?> servico, UUID origemId, CopiarPlanoRequest r) {
        if (r.pastaId() == null) {
            AcessoAtual.exigir("PASTA_ALTERAR"); // vai criar uma pasta nova
        }
        servico.exigirCopiavel(origemId, r.alunoId());
        UUID pastaId = r.pastaId() != null ? r.pastaId()
                : pastas.criar(r.alunoId(), new PastaRequest(r.titulo(), r.inicio(), r.fim())).id();
        var copia = servico.copiarParaAluno(origemId, r.alunoId(), pastaId, r.titulo());
        return new CopiaResposta(pastaId, copia.plano().id());
    }
}
