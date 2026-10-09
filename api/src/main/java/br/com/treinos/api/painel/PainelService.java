package br.com.treinos.api.painel;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.atualizacoes.AtualizacaoService;
import br.com.treinos.api.execucao.ExecucaoSerie;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.execucao.IndiceVersao;
import br.com.treinos.api.execucao.IndicesDeVersao;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Tela Início do treinador (seção 9.3). "Sem registro há 7 dias" é só informação: pode ter treinado sem registrar,
 * e nunca inativa ninguém.
 */
@Service
public class PainelService {

    private static final int LIMITE_LISTA = 20;
    private static final int ULTIMAS_EXECUCOES = 10;

    public record AlunoRef(UUID id, String nome) {
    }

    public record PlanoRef(UUID id, String titulo) {
    }

    public record AlunoSemRegistro(UUID id, String nome, LocalDate ultimoRegistro) {
    }

    public record ExecucaoRecente(AlunoRef aluno, LocalDate data, String sessao, int series) {
    }

    public record PlanoTerminando(PlanoRef plano, AlunoRef aluno, LocalDate fim) {
    }

    public record PainelTreinador(long alunosAtivos, List<AlunoSemRegistro> alunosSemRegistro7Dias,
                                  List<ExecucaoRecente> ultimasExecucoes, List<PlanoTerminando> planosTerminando,
                                  long atualizacoesParaRevisar, long atualizacoesAtrasadas,
                                  long atualizacoesAvisaramAtraso, long atualizacoesProximas) {
    }

    private final AlunoRepository alunos;
    private final ExecucaoSerieRepository execucoes;
    private final PlanoTreinoRepository planos;
    private final IndicesDeVersao indices;
    private final AtualizacaoService atualizacoes;

    public PainelService(AlunoRepository alunos, ExecucaoSerieRepository execucoes, PlanoTreinoRepository planos,
                         IndicesDeVersao indices, AtualizacaoService atualizacoes) {
        this.alunos = alunos;
        this.execucoes = execucoes;
        this.planos = planos;
        this.indices = indices;
        this.atualizacoes = atualizacoes;
    }

    @Transactional(readOnly = true)
    public PainelTreinador painel() {
        return painel(false);
    }

    @Transactional(readOnly = true)
    public PainelTreinador painel(boolean meus) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        UUID responsavelId = meus ? ((br.com.treinos.api.security.UsuarioAutenticado)
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal()).usuarioId() : null;
        List<Aluno> ativos = alunos.findByAtivoTrueOrderByNomeAsc().stream()
                .filter(a -> responsavelId == null || responsavelId.equals(a.getResponsavelId())).toList();
        Map<UUID, Aluno> porId = ativos.stream().collect(Collectors.toMap(Aluno::getId, Function.identity()));

        Map<UUID, LocalDate> ultimo = new HashMap<>();
        if (!ativos.isEmpty()) {
            execucoes.ultimoRegistro(porId.keySet()).forEach(u -> ultimo.put(u.alunoId(), u.data()));
        }
        List<AlunoSemRegistro> semRegistro = ativos.stream()
                .filter(a -> ultimo.get(a.getId()) == null || ultimo.get(a.getId()).isBefore(hoje.minusDays(7)))
                .limit(LIMITE_LISTA)
                .map(a -> new AlunoSemRegistro(a.getId(), a.getNome(), ultimo.get(a.getId())))
                .toList();

        List<PlanoTerminando> terminando = new ArrayList<>();
        for (PlanoTreino p : planos.findByAtivoTrueAndFimBetweenOrderByFimAsc(hoje, hoje.plusDays(7))) {
            Aluno a = porId.get(p.getAlunoId());
            if (a != null && terminando.size() < LIMITE_LISTA) {
                terminando.add(new PlanoTerminando(new PlanoRef(p.getId(), p.getTitulo()),
                        new AlunoRef(a.getId(), a.getNome()), p.getFim()));
            }
        }
        boolean registros = br.com.treinos.api.equipe.AcessoAtual.pode("REGISTRO_LER");
        boolean checkin = br.com.treinos.api.equipe.AcessoAtual.pode("ATUALIZACAO_LER")
                && br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_LER");
        return new PainelTreinador(ativos.size(), registros ? semRegistro : List.of(), registros ? ultimasExecucoes(porId) : List.of(),
                br.com.treinos.api.equipe.AcessoAtual.pode("TREINO_LER") ? terminando : List.of(),
                checkin ? contarAtualizacoes("PARA_REVISAR",porId) : 0, checkin ? contarAtualizacoes("ATRASADAS",porId) : 0,
                checkin ? contarAtualizacoes("AVISARAM_ATRASO",porId) : 0, checkin ? contarAtualizacoes("PROXIMAS",porId) : 0);
    }

    private long contarAtualizacoes(String situacao,Map<UUID,Aluno> alunosDoFiltro) {
        return atualizacoes.listar(situacao).stream().filter(a -> alunosDoFiltro.containsKey(a.alunoId())).count();
    }

    /** Agrupa os registros mais recentes por aluno, dia e sessão. Nomes de aluno só de alunos ativos. */
    private List<ExecucaoRecente> ultimasExecucoes(Map<UUID, Aluno> porId) {
        List<ExecucaoSerie> recentes = execucoes.findTop300ByOrderByRecebidoEmDesc();
        Map<UUID, IndiceVersao> indice = indices.carregar(recentes.stream()
                .map(ExecucaoSerie::getPlanoVersaoId).distinct().toList());
        record Grupo(UUID alunoId, LocalDate data, UUID sessaoUid, UUID versaoId) {
        }
        Map<Grupo, Integer> grupos = new LinkedHashMap<>();
        for (ExecucaoSerie e : recentes) {
            if (porId.containsKey(e.getAlunoId())) {
                grupos.merge(new Grupo(e.getAlunoId(), e.getData(), e.getSessaoUid(), e.getPlanoVersaoId()), 1,
                        Integer::sum);
            }
        }
        List<ExecucaoRecente> lista = new ArrayList<>();
        grupos.forEach((g, quantidade) -> {
            if (lista.size() < ULTIMAS_EXECUCOES) {
                Aluno a = porId.get(g.alunoId());
                IndiceVersao i = indice.get(g.versaoId());
                lista.add(new ExecucaoRecente(new AlunoRef(a.getId(), a.getNome()), g.data(),
                        i == null ? "Sessão" : i.nomeSessao(g.sessaoUid()), quantidade));
            }
        });
        return lista;
    }
}
