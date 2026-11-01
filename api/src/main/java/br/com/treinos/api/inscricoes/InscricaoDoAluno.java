package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoExportada;
import br.com.treinos.api.inscricoes.InscricaoDtos.NotaExportada;
import br.com.treinos.api.inscricoes.InscricaoDtos.PropostaExportada;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.UUID;

/**
 * A inscrição que virou o aluno, para a privacidade: a exportação do aluno a leva (revisão de segurança de 19/10: antes
 * ficava fora, e o arquivo não trazia tudo o que a consultoria guarda da pessoa) e, ao anonimizar o aluno, ela (nome,
 * WhatsApp, e-mail, objetivo, observação, respostas às perguntas do treinador e notas) é apagada inteira, dentro da
 * transação da anonimização. As respostas vão na exportação com o id da versão respondida, como as da anamnese.
 */
@Service
public class InscricaoDoAluno {

    private final InscricaoRepository inscricoes;
    private final InscricaoNotaRepository notas;
    private final JsonMapper json;

    public InscricaoDoAluno(InscricaoRepository inscricoes, InscricaoNotaRepository notas, JsonMapper json) {
        this.inscricoes = inscricoes;
        this.notas = notas;
        this.json = json;
    }

    /** Zero ou uma (uma inscrição vira no máximo um aluno, e um aluno vem de no máximo uma inscrição). */
    @Transactional(readOnly = true)
    public List<InscricaoExportada> exportar(UUID alunoId) {
        return inscricoes.findByAlunoId(alunoId).map(i -> List.of(new InscricaoExportada(i.getCriadaEm(), i.getNome(),
                i.getWhatsapp(), i.getEmail(), i.getObjetivo(), i.getObservacao(), i.getCienciaEm(), i.getCienciaTexto(),
                notas.findByInscricaoIdOrderByCriadaEmAsc(i.getId()).stream()
                        .map(n -> new NotaExportada(n.getCriadaEm(), n.getTexto())).toList(),
                i.getSexo() == null ? null : i.getSexo().name(), i.getInteresse(), i.getModalidadeDesejada(),
                i.getPrevisaoInicio(), i.getOrigemInformada(), i.temProposta() ? new PropostaExportada(
                        i.getPropostaPlanoNome(), i.getPropostaModalidade(), i.getPropostaPeriodicidade(),
                        i.getPropostaValorCentavos(), i.getPropostaCondicoes()) : null,
                i.getQuestionarioVersaoId(), i.getRespostas() == null ? null : json.readTree(i.getRespostas()))))
                .orElse(List.of());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID alunoId) {
        inscricoes.findByAlunoId(alunoId).ifPresent(i -> {
            notas.apagarDaInscricao(i.getId());
            inscricoes.delete(i);
            inscricoes.flush();
        });
    }
}
