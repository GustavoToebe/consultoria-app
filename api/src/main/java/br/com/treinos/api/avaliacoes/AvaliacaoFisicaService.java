package br.com.treinos.api.avaliacoes;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.AvaliacaoRequest;
import br.com.treinos.api.avaliacoes.AvaliacaoFisicaDtos.AvaliacaoResponse;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Avaliação física (circunferências em cm por data). Só a equipe grava; o aluno só lê as dele. O sistema guarda e
 * compara: nada de percentual de gordura, classificação ou interpretação. O peso vem do registro de peso da mesma data
 * (não é guardado de novo). Medidas são dado sensível (LGPD): nunca em log, a auditoria leva só o resumo fixo.
 */
@Service
public class AvaliacaoFisicaService {

    static final String CODIGO_INVALIDA = "AVALIACAO_INVALIDA";

    private final AvaliacaoFisicaRepository avaliacoes;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final Auditoria auditoria;

    public AvaliacaoFisicaService(AvaliacaoFisicaRepository avaliacoes, AlunoRepository alunos,
                                  RegistroPesoRepository pesos, Auditoria auditoria) {
        this.avaliacoes = avaliacoes;
        this.alunos = alunos;
        this.pesos = pesos;
        this.auditoria = auditoria;
    }

    /** Da mais recente para a mais antiga. Aluno de outra consultoria = 404. Também alimenta a exportação (LGPD). */
    @Transactional(readOnly = true)
    public List<AvaliacaoResponse> listar(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
        Map<LocalDate, BigDecimal> pesoPorData = new HashMap<>();
        for (RegistroPeso p : pesos.findByAlunoIdOrderByDataAsc(alunoId)) {
            pesoPorData.put(p.getData(), p.getPesoKg());
        }
        return avaliacoes.findByAlunoIdOrderByDataDesc(alunoId).stream()
                .map(a -> AvaliacaoResponse.de(a, pesoPorData.get(a.getData()))).toList();
    }

    @Transactional
    @Auditar(acao = "AVALIACAO_FISICA_REGISTRADA", entidade = "AVALIACAO_FISICA", resumo = "Registrou uma avaliação física.")
    public AvaliacaoResponse registrar(UUID alunoId, AvaliacaoRequest r, UUID usuarioId) {
        exigirAlunoParaGravar(alunoId);
        var valida = validar(r);
        if (avaliacoes.existsByAlunoIdAndData(alunoId, valida.data())) {
            throw dataEmUso();
        }
        AvaliacaoFisica a = new AvaliacaoFisica(alunoId, usuarioId);
        a.preencher(valida.data(), valida.medidas(), valida.observacao(), usuarioId);
        return resposta(gravar(a));
    }

    @Transactional
    @Auditar(acao = "AVALIACAO_FISICA_ALTERADA", entidade = "AVALIACAO_FISICA", resumo = "Alterou uma avaliação física.")
    public AvaliacaoResponse alterar(UUID id, AvaliacaoRequest r, UUID usuarioId) {
        AvaliacaoFisica a = buscar(id);
        exigirAlunoParaGravar(a.getAlunoId());
        conferirVersao(a, r.versao());
        var valida = validar(r);
        if (avaliacoes.existsByAlunoIdAndDataAndIdNot(a.getAlunoId(), valida.data(), id)) {
            throw dataEmUso();
        }
        a.preencher(valida.data(), valida.medidas(), valida.observacao(), usuarioId);
        return resposta(gravar(a));
    }

    /** {@code versao} opcional: quando vem e não é a atual, 409 (outra aba editou antes). */
    @Transactional
    public void excluir(UUID id, Long versao) {
        AvaliacaoFisica a = buscar(id);
        if (versao != null) {
            conferirVersao(a, versao);
        }
        avaliacoes.delete(a);
        avaliacoes.flush();
        auditoria.registrarEvento("AVALIACAO_FISICA_EXCLUIDA", "AVALIACAO_FISICA", id, "Excluiu uma avaliação física.");
    }

    /** Anonimização e "Excluir minha conta" (LGPD): as medidas saem inteiras. Roda na transação de quem chama. */
    @Transactional
    public void apagarDoAluno(UUID alunoId) {
        avaliacoes.deleteAll(avaliacoes.findByAlunoIdOrderByDataDesc(alunoId));
        avaliacoes.flush();
    }

    private static ValidacaoDaAvaliacao.Valida validar(AvaliacaoRequest r) {
        List<ApiError.FieldError> problemas = ValidacaoDaAvaliacao.problemas(r, LocalDate.now(Fuso.BRASILIA));
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira os dados da avaliação.", CODIGO_INVALIDA, problemas);
        }
        return ValidacaoDaAvaliacao.normalizar(r);
    }

    /** O índice único é a rede da corrida entre duas abas gravando a mesma data. */
    private AvaliacaoFisica gravar(AvaliacaoFisica a) {
        try {
            return avaliacoes.saveAndFlush(a);
        } catch (DataIntegrityViolationException corrida) {
            throw dataEmUso();
        }
    }

    private AvaliacaoResponse resposta(AvaliacaoFisica a) {
        BigDecimal peso = pesos.findByAlunoIdAndData(a.getAlunoId(), a.getData()).map(RegistroPeso::getPesoKg).orElse(null);
        return AvaliacaoResponse.de(a, peso);
    }

    private static ValidacaoException dataEmUso() {
        return new ValidacaoException("Confira os dados da avaliação.", CODIGO_INVALIDA,
                List.of(new ApiError.FieldError("data", "Já existe uma avaliação nesta data. Edite a que já existe.")));
    }

    private AvaliacaoFisica buscar(UUID id) {
        return avaliacoes.findById(id).orElseThrow(() -> new NaoEncontradoException("Avaliação não encontrada."));
    }

    private static void conferirVersao(AvaliacaoFisica a, Long versao) {
        if (versao == null || !versao.equals(a.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou esta avaliação. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    /** Gravar dado novo: o aluno existe e não foi anonimizado (medida corporal num cadastro anonimizado contraria a LGPD). */
    private void exigirAlunoParaGravar(UUID alunoId) {
        AlunoService.exigirNaoAnonimizado(
                alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
    }
}
