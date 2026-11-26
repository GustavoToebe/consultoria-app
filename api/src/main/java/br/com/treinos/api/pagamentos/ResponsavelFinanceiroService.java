package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.pagamentos.ResponsavelFinanceiroDtos.ResponsavelExportado;
import br.com.treinos.api.pagamentos.ResponsavelFinanceiroDtos.ResponsavelFinanceiroRequest;
import br.com.treinos.api.pagamentos.ResponsavelFinanceiroDtos.ResponsavelFinanceiroResponse;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * O responsável financeiro do aluno (D15, V092): no máximo um, recebe os lembretes de cobrança no lugar do aluno. Dado pessoal
 * de terceiro: nada daqui vai a log, auditoria nem mensagem de erro (as mensagens são fixas e a auditoria tem resumo fixo, só
 * quando algo muda). Escrever trava o aluno ({@code buscarParaAlterar}, a primeira trava da ordem do financeiro), o que também
 * impede dois PUT de criação ao mesmo tempo. O CPF do responsável segue a regra do CPF do aluno: só aparece com
 * {@code ALUNO_SENSIVEL_LER} e, sem ela, o do corpo é ignorado e o gravado fica.
 */
@Service
public class ResponsavelFinanceiroService {

    static final int NOME_MAXIMO = 120;
    static final int PARENTESCO_MAXIMO = 30;

    private final ResponsavelFinanceiroRepository responsaveis;
    private final AlunoRepository alunos;
    private final Auditoria auditoria;

    public ResponsavelFinanceiroService(ResponsavelFinanceiroRepository responsaveis, AlunoRepository alunos,
                                        Auditoria auditoria) {
        this.responsaveis = responsaveis;
        this.alunos = alunos;
        this.auditoria = auditoria;
    }

    /** Aluno de outra consultoria = 404. Sem responsável: 200 com tudo nulo (inclusive a {@code versao}). */
    @Transactional(readOnly = true)
    public ResponsavelFinanceiroResponse obter(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), ResponsavelFinanceiroService::alunoNaoEncontrado);
        return responsaveis.findByAlunoId(alunoId).map(this::resposta).orElse(ResponsavelFinanceiroResponse.NENHUM);
    }

    /**
     * Cria (sem {@code versao}) ou substitui (com a {@code versao} atual). Criar com versão, alterar sem ela ou com versão
     * velha = 409 {@code CONFLITO_EDICAO}. Aluno anonimizado = 409 {@code ALUNO_ANONIMIZADO}. Igual ao gravado = 200 sem auditoria.
     */
    @Transactional
    public ResponsavelFinanceiroResponse salvar(UUID alunoId, ResponsavelFinanceiroRequest r) {
        Aluno aluno = alunoParaAlterar(alunoId);
        boolean veCpf = AcessoAtual.pode("ALUNO_SENSIVEL_LER");
        Optional<ResponsavelFinanceiro> existente = responsaveis.findByAlunoId(alunoId);
        ResponsavelFinanceiro.Dados dados = validar(r, veCpf, existente.map(ResponsavelFinanceiro::getCpf).orElse(null));
        // Microssegundos, a precisão do timestamptz: a resposta do PUT sai igual à do GET seguinte.
        Instant agora = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        ResponsavelFinanceiro gravado;
        boolean mudou;
        if (existente.isEmpty()) {
            if (r.versao() != null) {
                throw conflito();
            }
            try {
                gravado = responsaveis.saveAndFlush(new ResponsavelFinanceiro(alunoId, dados, agora));
            } catch (DataIntegrityViolationException e) {
                if (ContratacaoService.violou(e, "ux_responsavel_financeiro_aluno")) {
                    throw conflito();
                }
                throw e;
            }
            mudou = true;
        } else {
            gravado = existente.get();
            if (r.versao() == null || !r.versao().equals(gravado.getVersao())) {
                throw conflito();
            }
            mudou = gravado.alterar(dados, agora);
            gravado = responsaveis.saveAndFlush(gravado);
        }
        if (mudou) {
            auditoria.registrarEvento("RESPONSAVEL_FINANCEIRO_DEFINIDO", "ALUNO", aluno.getId(),
                    "Definiu o responsável financeiro do aluno.");
        }
        return resposta(gravado);
    }

    /**
     * Remove o responsável. {@code versao} opcional: informada e diferente da atual = 409 {@code CONFLITO_EDICAO}. Sem
     * responsável é 204 sem auditoria (idempotente).
     */
    @Transactional
    public void remover(UUID alunoId, Long versao) {
        Aluno aluno = alunoParaAlterar(alunoId);
        Optional<ResponsavelFinanceiro> existente = responsaveis.findByAlunoId(alunoId);
        if (existente.isEmpty()) {
            return;
        }
        if (versao != null && !versao.equals(existente.get().getVersao())) {
            throw conflito();
        }
        responsaveis.delete(existente.get());
        responsaveis.flush();
        auditoria.registrarEvento("RESPONSAVEL_FINANCEIRO_REMOVIDO", "ALUNO", aluno.getId(),
                "Removeu o responsável financeiro do aluno.");
    }

    /** Exportação do aluno (LGPD): quem chama já conferiu {@code FINANCEIRO_LER}; o CPF só sai com {@code ALUNO_SENSIVEL_LER}. */
    @Transactional(readOnly = true)
    public ResponsavelExportado exportar(UUID alunoId) {
        boolean veCpf = AcessoAtual.pode("ALUNO_SENSIVEL_LER");
        return responsaveis.findByAlunoId(alunoId)
                .map(r -> new ResponsavelExportado(r.getNome(), r.getParentesco(), veCpf ? r.getCpf() : null, r.getTelefone(),
                        r.getEmail(), r.getAtualizadoEm()))
                .orElse(null);
    }

    /** Nome e CPF para o texto do contrato digital; quem chama já conferiu {@code FINANCEIRO_LER}. Sem responsável, vazio. */
    @Transactional(readOnly = true)
    Optional<PagamentosDoAluno.ResponsavelParaContrato> paraContrato(UUID alunoId) {
        return responsaveis.findByAlunoId(alunoId).map(r -> new PagamentosDoAluno.ResponsavelParaContrato(r.getNome(), r.getCpf()));
    }

    /** Anonimização e "Excluir minha conta": apaga a linha (o aluno não é apagado, então o cascade não roda). */
    void apagarDoAluno(UUID alunoId) {
        responsaveis.findByAlunoId(alunoId).ifPresent(responsaveis::delete);
        responsaveis.flush();
    }

    private Aluno alunoParaAlterar(UUID alunoId) {
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(ResponsavelFinanceiroService::alunoNaoEncontrado);
        AlunoService.exigirNaoAnonimizado(aluno);
        return aluno;
    }

    private ResponsavelFinanceiroResponse resposta(ResponsavelFinanceiro r) {
        return new ResponsavelFinanceiroResponse(r.getNome(), r.getParentesco(),
                AcessoAtual.pode("ALUNO_SENSIVEL_LER") ? r.getCpf() : null, r.getTelefone(), r.getEmail(), r.getVersao(),
                r.getAtualizadoEm());
    }

    /** Mensagens fixas: o valor digitado (dado pessoal) nunca é repetido. */
    private static ResponsavelFinanceiro.Dados validar(ResponsavelFinanceiroRequest r, boolean veCpf, String cpfGravado) {
        List<ApiError.FieldError> problemas = new ArrayList<>();
        String nome = limpo(r.nome());
        if (nome == null) {
            problemas.add(new ApiError.FieldError("nome", "Informe o nome do responsável."));
        } else if (nome.length() > NOME_MAXIMO) {
            problemas.add(new ApiError.FieldError("nome", "O nome pode ter até " + NOME_MAXIMO + " caracteres."));
        }
        String parentesco = limpo(r.parentesco());
        if (parentesco != null && parentesco.length() > PARENTESCO_MAXIMO) {
            problemas.add(new ApiError.FieldError("parentesco", "O parentesco pode ter até " + PARENTESCO_MAXIMO + " caracteres."));
        }
        String cpf = cpfGravado;
        if (veCpf) {
            try {
                cpf = Formatos.cpf(r.cpf());
            } catch (BadRequestException e) {
                problemas.add(new ApiError.FieldError("cpf", "CPF inválido."));
            }
        }
        String telefone = null;
        try {
            telefone = Formatos.telefone(r.telefone());
        } catch (BadRequestException e) {
            problemas.add(new ApiError.FieldError("telefone", "Telefone inválido. Informe o DDD e o número."));
        }
        String email = limpo(r.email());
        if (email != null && PreparoDoLembrete.valido(email) == null) {
            problemas.add(new ApiError.FieldError("email", "E-mail inválido."));
        }
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira os dados do responsável financeiro.", "RESPONSAVEL_INVALIDO", problemas);
        }
        return new ResponsavelFinanceiro.Dados(nome, parentesco, cpf, telefone, email);
    }

    private static String limpo(String texto) {
        if (texto == null) {
            return null;
        }
        String s = texto.strip();
        return s.isEmpty() ? null : s;
    }

    private static NaoEncontradoException alunoNaoEncontrado() {
        return new NaoEncontradoException("Aluno não encontrado.");
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou o responsável financeiro. Recarregue para ver a versão atual.",
                "CONFLITO_EDICAO");
    }
}
