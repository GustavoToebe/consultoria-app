package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PodResumo;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Pods da comunidade (V082): grupos pequenos, criados e preenchidos só pela equipe ({@code COMUNIDADE_MODERAR}). Um aluno está em
 * no máximo um pod; só entra aluno ativo, não anonimizado e com acesso ({@code usuario_id}); o teto é de {@value #TETO} membros.
 * O nome do pod (texto livre) e quem está em qual pod nunca vão a log nem à auditoria: os resumos são fixos. Não há "excluir pod"
 * na v1 (o post do pod é {@code ON DELETE NO ACTION}, que barra apagar o pod com post, e o grupo vazio não custa nada).
 */
@Service
@Transactional
public class PodsService {

    static final int TETO = 12;
    static final int NOME_MINIMO = 2;
    static final int NOME_MAXIMO = 40;

    static final String RESUMO_CRIADO = "Criou um pod da comunidade.";
    static final String RESUMO_ALTERADO = "Renomeou um pod da comunidade.";
    static final String RESUMO_ALUNO_ALTERADO = "Alterou o pod de um aluno.";

    private final ComunidadePodRepository pods;
    private final AlunoRepository alunos;
    private final Auditoria auditoria;

    public PodsService(ComunidadePodRepository pods, AlunoRepository alunos, Auditoria auditoria) {
        this.pods = pods;
        this.alunos = alunos;
        this.auditoria = auditoria;
    }

    /** Todos os pods da consultoria com a contagem de membros e se algum membro é menor de 18 anos (sem nome nem idade). */
    @Transactional(readOnly = true)
    public List<PodResumo> listar() {
        Map<UUID, AlunoRepository.ContagemDoPod> contagens = contagens();
        return pods.findAllByOrderByNomeAscIdAsc().stream().map(p -> resumo(p, contagens.get(p.getId()))).toList();
    }

    public PodResumo criar(String nome) {
        ComunidadePod pod = new ComunidadePod(nomeLimpo(nome));
        salvar(pod);
        auditoria.registrarEvento("POD_CRIADO", "COMUNIDADE_POD", pod.getId(), RESUMO_CRIADO);
        return resumo(pod, contagens().get(pod.getId()));
    }

    /** Renomear; a auditoria só sai se o nome mudou. */
    public PodResumo alterar(UUID id, String nome) {
        ComunidadePod pod = pods.findById(id).orElseThrow(() -> new NaoEncontradoException("Pod não encontrado."));
        String limpo = nomeLimpo(nome);
        if (!limpo.equals(pod.getNome())) {
            pod.renomear(limpo);
            salvar(pod);
            auditoria.registrarEvento("POD_ALTERADO", "COMUNIDADE_POD", pod.getId(), RESUMO_ALTERADO);
        }
        return resumo(pod, contagens().get(pod.getId()));
    }

    /**
     * Põe o aluno no pod ({@code podId} nulo tira). Idempotente (mesmo pod = nada). Recusas: 404 (aluno ou pod de outra
     * consultoria), 409 {@code ALUNO_ANONIMIZADO}, {@code ALUNO_INATIVO}, {@code ALUNO_SEM_ACESSO} e {@code POD_CHEIO}. A linha do
     * pod é travada antes de contar, então dois pedidos simultâneos não passam do teto; a escrita é um UPDATE condicional (nunca a
     * entidade), então uma ficha lida antes e salva depois não desfaz o pod.
     */
    public void atribuir(UUID alunoId, UUID podId) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (podId == null) {
            if (alunos.podDoAluno(alunoId).isPresent()) {
                alunos.tirarDoPod(aluno.getConsultoriaId(), alunoId);
                auditoria.registrarEvento("ALUNO_POD_ALTERADO", "ALUNO", alunoId, RESUMO_ALUNO_ALTERADO);
            }
            return;
        }
        if (pods.travar(podId).isEmpty()) {
            throw new NaoEncontradoException("Pod não encontrado.");
        }
        // Lido só depois da trava do pod: o pedido que esperava a vez vê o pod que o outro acabou de gravar (sem falso POD_CHEIO).
        UUID atual = alunos.podDoAluno(alunoId).orElse(null);
        AlunoService.exigirNaoAnonimizado(aluno);
        exigirAtivoComAcesso(aluno);
        if (podId.equals(atual)) {
            return;
        }
        if (alunos.contarDoPod(podId) >= TETO) {
            throw new ConflictException("O pod já tem " + TETO + " alunos.", "POD_CHEIO");
        }
        if (alunos.colocarNoPod(aluno.getConsultoriaId(), alunoId, podId) != 1) {
            // O aluno mudou de situação entre a leitura e o UPDATE (o UPDATE limpa o contexto): relê para dizer o motivo.
            Aluno agora = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
            AlunoService.exigirNaoAnonimizado(agora);
            exigirAtivoComAcesso(agora);
            throw new ConflictException("O aluno não está disponível para entrar num pod.", "ALUNO_INATIVO");
        }
        auditoria.registrarEvento("ALUNO_POD_ALTERADO", "ALUNO", alunoId, RESUMO_ALUNO_ALTERADO);
    }

    private static void exigirAtivoComAcesso(Aluno aluno) {
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo não entra num pod.", "ALUNO_INATIVO");
        }
        if (aluno.getUsuarioId() == null) {
            throw new ConflictException("Só entra num pod o aluno que já tem acesso ao app.", "ALUNO_SEM_ACESSO");
        }
    }

    /** O nome já limpo (strip e NFC), de 2 a 40 caracteres; fora disso 422 {@code POD_INVALIDO} no campo, sem repetir o valor. */
    static String nomeLimpo(String nome) {
        String limpo = nome == null ? "" : Normalizer.normalize(nome.strip(), Normalizer.Form.NFC);
        // length() nunca é mais frouxo que o char_length do banco; o mínimo conta caracteres (um emoji vale 1).
        if (limpo.codePointCount(0, limpo.length()) < NOME_MINIMO || limpo.length() > NOME_MAXIMO) {
            throw new ValidacaoException("Confira o pod.", "POD_INVALIDO",
                    List.of(new ApiError.FieldError("nome", "Use de " + NOME_MINIMO + " a " + NOME_MAXIMO + " caracteres.")));
        }
        return limpo;
    }

    /** Só o índice único do nome (sem diferença de maiúsculas) pode falhar aqui: o tamanho já foi conferido. */
    private void salvar(ComunidadePod pod) {
        try {
            pods.saveAndFlush(pod);
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Já existe um pod com esse nome.", "POD_NOME_EM_USO");
        }
    }

    private Map<UUID, AlunoRepository.ContagemDoPod> contagens() {
        Map<UUID, AlunoRepository.ContagemDoPod> mapa = new HashMap<>();
        alunos.contagensDosPods(LocalDate.now(Fuso.BRASILIA).minusYears(18)).forEach(c -> mapa.put(c.getPodId(), c));
        return mapa;
    }

    private static PodResumo resumo(ComunidadePod p, AlunoRepository.ContagemDoPod c) {
        return new PodResumo(p.getId(), p.getNome(), c == null ? 0 : c.getMembros(), c != null && c.getMenores() > 0, p.getCriadoEm());
    }
}
