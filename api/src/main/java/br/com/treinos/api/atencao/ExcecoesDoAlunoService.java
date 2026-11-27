package br.com.treinos.api.atencao;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.atencao.ExcecoesDoAlunoDtos.Excecao;
import br.com.treinos.api.atencao.ExcecoesDoAlunoDtos.ExcecaoRequest;
import br.com.treinos.api.atencao.RegrasDeAtencaoDtos.PerguntaDisponivel;
import br.com.treinos.api.atencao.ExcecoesDoAlunoDtos.RegraDoAluno;
import br.com.treinos.api.atencao.ExcecoesDoAlunoDtos.RegrasDoAluno;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Exceção por aluno (etapa 2, C8): desligar uma regra ou trocar o número só para um aluno. Vale a partir do próximo envio (o fato
 * congela o número vigente, R3). Quem grava trava o aluno ({@code buscarParaAlterar}), como as tags: a anonimização, que apaga as
 * exceções, espera ou é esperada. Auditoria de resumo fixo, sem número nem regra.
 */
@Service
public class ExcecoesDoAlunoService {

    private static final String CODIGO = "REGRA_INVALIDA";

    private final ExcecaoDoAlunoRepository excecoes;
    private final RegraDeAtencaoRepository regras;
    private final AlunoRepository alunos;
    private final RegrasDeAtencaoService regrasDaConsultoria;
    private final Auditoria auditoria;

    public ExcecoesDoAlunoService(ExcecaoDoAlunoRepository excecoes, RegraDeAtencaoRepository regras, AlunoRepository alunos,
            RegrasDeAtencaoService regrasDaConsultoria, Auditoria auditoria) {
        this.excecoes = excecoes;
        this.regras = regras;
        this.alunos = alunos;
        this.regrasDaConsultoria = regrasDaConsultoria;
        this.auditoria = auditoria;
    }

    /** As regras ligadas da consultoria com a exceção do aluno em cada uma. Aluno de outra consultoria 404. */
    @Transactional(readOnly = true)
    public RegrasDoAluno listar(UUID alunoId) {
        if (alunos.findById(alunoId).isEmpty()) {
            throw alunoNaoEncontrado();
        }
        return resposta(alunoId);
    }

    /**
     * Cria ou altera a exceção. Ordem das recusas: aluno 404, anonimizado 409 {@code ALUNO_ANONIMIZADO}, regra 404, número 422
     * {@code REGRA_INVALIDA} em {@code ativa|limite}, versão 409 {@code CONFLITO_EDICAO}. Nada mudou = 200 sem gravar nem auditar.
     */
    @Transactional
    public RegrasDoAluno definir(UUID alunoId, UUID regraId, ExcecaoRequest r) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(ExcecoesDoAlunoService::alunoNaoEncontrado);
        AlunoService.exigirNaoAnonimizado(aluno);
        RegraDeAtencao regra = regras.findById(regraId).orElseThrow(() -> new NaoEncontradoException("Regra não encontrada."));
        boolean ativa = r.ativa();
        BigDecimal limite = ativa ? numero(regra, r.limite()) : null;
        ExcecaoDoAluno existente = excecoes.findByAlunoIdAndRegraId(alunoId, regraId).orElse(null);
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if (existente == null) {
            if (r.versao() != null) {
                throw conflito();
            }
            excecoes.saveAndFlush(new ExcecaoDoAluno(regraId, alunoId, ativa, limite, agora));
            auditar(alunoId);
        } else {
            if (r.versao() == null || !r.versao().equals(existente.getVersao())) {
                throw conflito();
            }
            if (existente.alterar(ativa, limite, agora)) {
                excecoes.flush();
                auditar(alunoId);
            }
        }
        return resposta(alunoId);
    }

    /** Volta à regra geral (apaga a exceção). Idempotente: sem exceção, 204 sem auditar. Aluno ou regra de outra consultoria 404. */
    @Transactional
    public void voltarAGeral(UUID alunoId, UUID regraId) {
        if (alunos.buscarParaAlterar(alunoId).isEmpty()) {
            throw alunoNaoEncontrado();
        }
        if (regras.findById(regraId).isEmpty()) {
            throw new NaoEncontradoException("Regra não encontrada.");
        }
        excecoes.findByAlunoIdAndRegraId(alunoId, regraId).ifPresent(e -> {
            excecoes.delete(e);
            excecoes.flush();
            auditoria.registrarEvento("REGRA_ATENCAO_EXCECAO_REMOVIDA", "ALUNO", alunoId,
                    "Voltou o aluno à regra geral de atenção.");
        });
    }

    /** O número do aluno: a mesma faixa da regra geral (C3); a mensagem diz a faixa, nunca o valor. */
    private BigDecimal numero(RegraDeAtencao regra, BigDecimal limite) {
        TipoDeRegra tipo = regra.getTipo();
        if (!tipo.temLimite()) {
            throw invalida("ativa", "Neste modelo a exceção só desliga a regra.");
        }
        if (limite == null) {
            throw invalida("limite", "Informe o número.");
        }
        PerguntaDisponivel pergunta = null;
        if (tipo == TipoDeRegra.NOTA_ABAIXO) {
            pergunta = regrasDaConsultoria.perguntas().stream()
                    .filter(p -> p.perguntaId().equals(regra.getPerguntaId()) && p.tipo().equals(tipo.tipoDaPergunta()))
                    .findFirst().orElse(null);
        }
        String erro = RegrasDeAtencaoService.erroDoLimite(tipo, limite, pergunta);
        if (erro != null) {
            throw invalida("limite", erro);
        }
        return limite.setScale(1, RoundingMode.UNNECESSARY);
    }

    private RegrasDoAluno resposta(UUID alunoId) {
        Map<UUID, ExcecaoDoAluno> porRegra = excecoes.findByAlunoId(alunoId).stream()
                .collect(Collectors.toMap(ExcecaoDoAluno::getRegraId, Function.identity()));
        List<RegraDoAluno> lista = regras.findAllByOrderByCriadoEmAscIdAsc().stream().filter(RegraDeAtencao::isAtiva).map(g -> {
            ExcecaoDoAluno e = porRegra.get(g.getId());
            return new RegraDoAluno(g.getId(), g.getTipo().name(), g.getPerguntaId(), g.getLimite(),
                    e == null ? null : new Excecao(e.isAtiva(), e.getLimite(), e.getVersao()));
        }).toList();
        return new RegrasDoAluno(lista);
    }

    private void auditar(UUID alunoId) {
        auditoria.registrarEvento("REGRA_ATENCAO_EXCECAO_DEFINIDA", "ALUNO", alunoId, "Ajustou uma regra de atenção só para o aluno.");
    }

    private static NaoEncontradoException alunoNaoEncontrado() {
        return new NaoEncontradoException("Aluno não encontrado.");
    }

    private static ValidacaoException invalida(String campo, String mensagem) {
        return new ValidacaoException("Confira a exceção.", CODIGO, List.of(new ApiError.FieldError(campo, mensagem)));
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou esta exceção. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
    }
}
