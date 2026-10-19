package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoExportada;
import br.com.treinos.api.inscricoes.InscricaoDtos.NotaExportada;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * A inscrição que virou o aluno, para a privacidade: a exportação do aluno a leva (revisão de segurança de 19/10: antes
 * ficava fora, e o arquivo não trazia tudo o que a consultoria guarda da pessoa) e, ao anonimizar o aluno, ela (nome,
 * WhatsApp, e-mail, objetivo, observação e notas) é apagada inteira, dentro da transação da anonimização.
 */
@Service
public class InscricaoDoAluno {

    private final InscricaoRepository inscricoes;
    private final InscricaoNotaRepository notas;

    public InscricaoDoAluno(InscricaoRepository inscricoes, InscricaoNotaRepository notas) {
        this.inscricoes = inscricoes;
        this.notas = notas;
    }

    /** Zero ou uma (uma inscrição vira no máximo um aluno, e um aluno vem de no máximo uma inscrição). */
    @Transactional(readOnly = true)
    public List<InscricaoExportada> exportar(UUID alunoId) {
        return inscricoes.findByAlunoId(alunoId).map(i -> List.of(new InscricaoExportada(i.getCriadaEm(), i.getNome(),
                i.getWhatsapp(), i.getEmail(), i.getObjetivo(), i.getObservacao(), i.getCienciaEm(), i.getCienciaTexto(),
                notas.findByInscricaoIdOrderByCriadaEmAsc(i.getId()).stream()
                        .map(n -> new NotaExportada(n.getCriadaEm(), n.getTexto())).toList()))).orElse(List.of());
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
