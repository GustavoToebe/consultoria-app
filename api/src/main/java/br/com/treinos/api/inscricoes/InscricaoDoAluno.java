package br.com.treinos.api.inscricoes;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * A inscrição que virou o aluno, para a privacidade: ao anonimizar o aluno, a inscrição ligada a ele (nome, WhatsApp,
 * e-mail, objetivo, observação e notas) é apagada inteira. Roda dentro da transação da anonimização.
 */
@Service
public class InscricaoDoAluno {

    private final InscricaoRepository inscricoes;
    private final InscricaoNotaRepository notas;

    public InscricaoDoAluno(InscricaoRepository inscricoes, InscricaoNotaRepository notas) {
        this.inscricoes = inscricoes;
        this.notas = notas;
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
