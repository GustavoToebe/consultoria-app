package br.com.treinos.api.atualizacoes;

import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.pastas.PastaDtos.PesoSugeridoDaPasta;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.questionarios.QuestionarioVersaoRepository;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

/**
 * Peso que a atualização da pasta gravou, para pré-preencher o "Finalizar pasta". Não calcula nem inventa nada: lê o
 * registro de peso do aluno na data da atualização, mas só se a atualização foi ENVIADA ou REVISADA e o aluno respondeu a
 * pergunta {@code PESO} (é assim que o envio grava o peso). Um peso lançado à mão nesse dia, sem a pergunta respondida, não
 * conta como da atualização. Sem atualização, sem resposta ou sem registro: ambos nulos (nunca zero). Dado sensível: não
 * vai a log nem a auditoria.
 */
@Service
public class PesoSugeridoDaPastaService {

    private static final PesoSugeridoDaPasta NENHUM = new PesoSugeridoDaPasta(null, null);

    private final PastaRepository pastas;
    private final AtualizacaoRepository atualizacoes;
    private final QuestionarioVersaoRepository versoes;
    private final RegistroPesoRepository pesos;
    private final JsonMapper json;

    public PesoSugeridoDaPastaService(PastaRepository pastas, AtualizacaoRepository atualizacoes,
                                      QuestionarioVersaoRepository versoes, RegistroPesoRepository pesos, JsonMapper json) {
        this.pastas = pastas;
        this.atualizacoes = atualizacoes;
        this.versoes = versoes;
        this.pesos = pesos;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public PesoSugeridoDaPasta doPasta(UUID pastaId) {
        // Pasta de outra consultoria some no filtro de tenant: 404.
        Exigir.existe(pastas.findById(pastaId), () -> new NaoEncontradoException("Pasta não encontrada."));
        var atualizacao = atualizacoes.findByPastaId(pastaId)
                .filter(a -> "ENVIADA".equals(a.getEstado()) || "REVISADA".equals(a.getEstado()))
                .filter(a -> a.getQuestionarioVersaoId() != null).orElse(null);
        if (atualizacao == null) {
            return NENHUM;
        }
        var versao = versoes.findById(atualizacao.getQuestionarioVersaoId()).orElse(null);
        if (versao == null) {
            return NENHUM;
        }
        String idDoPeso = AtualizacaoService.idDaPergunta(json.readTree(versao.getConteudo()), "PESO");
        if (idDoPeso.isEmpty() || !json.readTree(atualizacao.getRespostas()).path(idDoPeso).isNumber()) {
            return NENHUM;
        }
        return pesos.findByAlunoIdAndData(atualizacao.getAlunoId(), atualizacao.getDataAtualizacao())
                .filter(p -> p.getPesoKg() != null && p.getPesoKg().signum() > 0)
                .map(p -> new PesoSugeridoDaPasta(p.getPesoKg(), p.getData()))
                .orElse(NENHUM);
    }
}
