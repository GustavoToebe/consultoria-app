package br.com.treinos.api.pagamentos;

import br.com.treinos.api.alunos.Aluno;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * A ordem única das travas do financeiro: aluno, depois contratação (quando a cobrança tem), depois cobrança. Quem muda a contratação ou gera
 * cobrança entra por aqui, e é isso que serializa clique duplo, pausar durante uma baixa e a corrida com a anonimização.
 * O dono e a contratação são lidos antes (projeção), para a entidade de baixo só entrar na sessão já travada.
 */
@Component
class Travas {

    record DaContratacao(Aluno aluno, ContratacaoAluno contratacao) {
    }

    /** {@code contratacao} é nula na cobrança avulsa (sem contratação): quem usa confere antes de olhar para ela. */
    record DaCobranca(Aluno aluno, ContratacaoAluno contratacao, CobrancaAluno cobranca) {
    }

    private final AlunoRepository alunos;
    private final ContratacaoAlunoRepository contratacoes;
    private final CobrancaAlunoRepository cobrancas;

    Travas(AlunoRepository alunos, ContratacaoAlunoRepository contratacoes, CobrancaAlunoRepository cobrancas) {
        this.alunos = alunos;
        this.contratacoes = contratacoes;
        this.cobrancas = cobrancas;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    DaContratacao daContratacao(UUID contratacaoId) {
        UUID alunoId = contratacoes.donoDe(contratacaoId).orElseThrow(Travas::contratacaoNaoEncontrada).getAlunoId();
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(Travas::alunoNaoEncontrado);
        exigirAlunoNaConsultoria(aluno);
        ContratacaoAluno contratacao = contratacoes.buscarParaAlterar(contratacaoId)
                .orElseThrow(Travas::contratacaoNaoEncontrada);
        return new DaContratacao(aluno, contratacao);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    DaCobranca daCobranca(UUID cobrancaId) {
        return travar(cobrancaId, Exigencia.ATIVO);
    }

    /**
     * A mesma ordem, aceitando aluno <b>inativo</b> (anonimizado segue recusado, 409): quem saiu ainda pode ter cobrança
     * vencida ou de saída em aberto, e o treinador precisa dar baixa, desfazer a baixa manual ou cancelar. Só essas três ações
     * usam; contestar, estornar, link, contratar, retomar e alterar seguem por {@link #daCobranca}.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    DaCobranca daCobrancaDeAlunoQueSaiu(UUID cobrancaId) {
        return travar(cobrancaId, Exigencia.INATIVO_OK);
    }

    /**
     * A mesma ordem (aluno, contratação, cobrança), mas sem recusar aluno inativo ou anonimizado: o provedor confirma um
     * pagamento que já aconteceu, e quem saiu depois não pode deixar a baixa ou a conferência em 409 para sempre. Só o caminho
     * que vem do provedor usa; o do treinador segue por {@link #daCobranca}.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    DaCobranca daCobrancaDoProvedor(UUID cobrancaId) {
        return travar(cobrancaId, Exigencia.QUALQUER);
    }

    /** O que se exige do aluno ao travar uma cobrança. */
    private enum Exigencia { ATIVO, INATIVO_OK, QUALQUER }

    private DaCobranca travar(UUID cobrancaId, Exigencia exigencia) {
        var travas = cobrancas.referenciasDe(cobrancaId).orElseThrow(Travas::cobrancaNaoEncontrada);
        Aluno aluno = alunos.buscarParaAlterar(travas.getAlunoId()).orElseThrow(Travas::alunoNaoEncontrado);
        if (exigencia == Exigencia.ATIVO) {
            exigirAlunoNaConsultoria(aluno);
        } else if (exigencia == Exigencia.INATIVO_OK) {
            AlunoService.exigirNaoAnonimizado(aluno);
        }
        // Cobrança avulsa não tem contratação: a ordem fica aluno → cobrança.
        ContratacaoAluno contratacao = travas.getContratacaoId() == null ? null
                : contratacoes.buscarParaAlterar(travas.getContratacaoId()).orElseThrow(Travas::contratacaoNaoEncontrada);
        CobrancaAluno cobranca = cobrancas.buscarParaAlterar(cobrancaId).orElseThrow(Travas::cobrancaNaoEncontrada);
        return new DaCobranca(aluno, contratacao, cobranca);
    }

    /**
     * Por padrão quem saiu (inativo ou anonimizado) não recebe mudança de contratação ou cobrança. As exceções são as de
     * {@link #daCobrancaDeAlunoQueSaiu} (baixa manual, desfazer baixa e cancelar, para o inativo que ainda deve) e a do provedor;
     * anonimizado nunca. A saída em si ({@link PagamentosDoAluno#encerrarPorInativacao}) não passa por aqui.
     */
    private static void exigirAlunoNaConsultoria(Aluno aluno) {
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Este aluno está inativo; reative-o para mexer no financeiro.", "ALUNO_INATIVO");
        }
    }

    /** 404 se o aluno não existe nesta consultoria (o filtro do tenant vale na leitura). */
    static void exigirAluno(AlunoRepository alunos, UUID alunoId) {
        if (!alunos.existsById(alunoId)) {
            throw alunoNaoEncontrado();
        }
    }

    static NaoEncontradoException alunoNaoEncontrado() {
        return new NaoEncontradoException("Aluno não encontrado.");
    }

    static NaoEncontradoException contratacaoNaoEncontrada() {
        return new NaoEncontradoException("Contratação não encontrada.");
    }

    static NaoEncontradoException cobrancaNaoEncontrada() {
        return new NaoEncontradoException("Cobrança não encontrada.");
    }
}
