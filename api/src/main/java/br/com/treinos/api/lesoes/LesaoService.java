package br.com.treinos.api.lesoes;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.lesoes.LesaoDtos.LesaoRequest;
import br.com.treinos.api.lesoes.LesaoDtos.LesaoResponse;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Histórico de lesões do aluno: o treinador registra (região, descrição, datas, situação, observação). O sistema só
 * guarda e mostra; não interpreta nem sugere nada.
 */
@Service
public class LesaoService {

    private final LesaoRepository lesoes;
    private final AlunoRepository alunos;

    public LesaoService(LesaoRepository lesoes, AlunoRepository alunos) {
        this.lesoes = lesoes;
        this.alunos = alunos;
    }

    @Transactional(readOnly = true)
    public List<LesaoResponse> listar(UUID alunoId) {
        exigirAluno(alunoId);
        return lesoes.findByAlunoIdOrderByDataInicioDescCriadoEmDesc(alunoId).stream().map(LesaoResponse::de).toList();
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="LESAO_REGISTRADA",entidade="LESAO",resumo="Registrou uma lesão.")
    public LesaoResponse criar(UUID alunoId, LesaoRequest r, UUID usuarioId) {
        exigirAluno(alunoId);
        LesaoAluno l = new LesaoAluno(alunoId, usuarioId);
        preencher(l, r);
        return LesaoResponse.de(lesoes.saveAndFlush(l));
    }

    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="LESAO_ALTERADA",entidade="LESAO",resumo="Alterou um registro de lesão.")
    public LesaoResponse alterar(UUID alunoId, UUID id, LesaoRequest r) {
        LesaoAluno l = buscar(alunoId, id);
        preencher(l, r);
        return LesaoResponse.de(lesoes.saveAndFlush(l));
    }

    @Transactional
    public void excluir(UUID alunoId, UUID id) {
        lesoes.delete(buscar(alunoId, id));
    }

    private static void preencher(LesaoAluno l, LesaoRequest r) {
        if (r.dataInicio() != null && r.dataFim() != null && r.dataFim().isBefore(r.dataInicio())) {
            throw new BadRequestException("A data de fim não pode ser antes do início.");
        }
        l.preencher(r.regiao().trim(), Buscas.opcional(r.descricao()), r.dataInicio(), r.dataFim(), r.situacao(),
                Buscas.opcional(r.observacao()));
    }

    private LesaoAluno buscar(UUID alunoId, UUID id) {
        return lesoes.findByIdAndAlunoId(id, alunoId)
                .orElseThrow(() -> new NaoEncontradoException("Lesão não encontrada."));
    }

    private void exigirAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
    }
}
