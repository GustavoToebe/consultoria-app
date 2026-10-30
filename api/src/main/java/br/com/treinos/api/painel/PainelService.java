package br.com.treinos.api.painel;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.atualizacoes.AtualizacaoService;
import br.com.treinos.api.execucao.ExecucaoSerie;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.execucao.IndiceVersao;
import br.com.treinos.api.execucao.IndicesDeVersao;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.retorno.RetornoProperties;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository;
import br.com.treinos.api.recordes.RecordesDaSemanaService;
import br.com.treinos.api.treino.PlanoTreino;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import br.com.plataforma.comum.web.BadRequestException;
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
 * Tela Início do treinador. "Sem registro há N dias" (N escolhido por quem vê, de 1 a 90) é só informação: pode ter treinado sem registrar,
 * e nunca inativa ninguém.
 */
@Service
public class PainelService {

    public static final int DIAS_SEM_REGISTRO_PADRAO = 7;
    public static final int DIAS_SEM_REGISTRO_MAXIMO = 90;
    private static final int LIMITE_LISTA = 20;
    /** "A renovar": pasta que termina em até 7 dias (ou já terminou); igual a {@code DIAS_PARA_RENOVAR} do app. */
    private static final int DIAS_PARA_RENOVAR = 7;
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

    public record PastaRef(UUID id, String titulo) {
    }

    /** Pasta que pede renovação (mesma forma do {@link PlanoTerminando}, mas de pasta). */
    public record PastaARenovar(PastaRef pasta, AlunoRef aluno, LocalDate fim) {
    }

    /**
     * {@code pastasParaRenovar} é lista (até 20, do fim mais antigo ao mais novo; vazia sem {@code TREINO_LER}, como a
     * {@code planosTerminando}). Os outros quatro campos novos são só contagens (sem nome nem id) e {@code null} quando o
     * treinador não pode ver (nunca zero): {@code pastasARenovar} (o total da lista, sem teto) e
     * {@code alunosSemPastaComPeriodo} pedem {@code TREINO_LER}; {@code alunosSemRegistroTotal}, {@code REGISTRO_LER};
     * {@code alunosSemAcesso} segue o {@code alunosAtivos} (sem permissão extra).
     * {@code sessoesConcluidas7Dias}: sessões concluídas (completas e parciais) dos alunos do escopo nos últimos
     * {@value RecordesDaSemanaService#DIAS} dias (hoje de Brasília incluído), só número; {@code null} (nunca zero) sem
     * {@code REGISTRO_LER} ou com o retorno desligado ({@code treinos.retorno.habilitado}).
     */
    public record PainelTreinador(long alunosAtivos, List<AlunoSemRegistro> alunosSemRegistro,
                                  List<ExecucaoRecente> ultimasExecucoes, List<PlanoTerminando> planosTerminando,
                                  long atualizacoesParaRevisar, long atualizacoesAtrasadas,
                                  long atualizacoesAvisaramAtraso, long atualizacoesProximas,
                                  Long pastasARenovar, List<PastaARenovar> pastasParaRenovar,
                                  Long alunosSemPastaComPeriodo, Long alunosSemRegistroTotal, Long alunosSemAcesso,
                                  Long sessoesConcluidas7Dias) {
    }

    private final AlunoRepository alunos;
    private final ExecucaoSerieRepository execucoes;
    private final PlanoTreinoRepository planos;
    private final IndicesDeVersao indices;
    private final AtualizacaoService atualizacoes;
    private final PastaRepository pastas;
    private final SessaoConcluidaRepository sessoesConcluidas;
    private final RetornoProperties retorno;

    public PainelService(AlunoRepository alunos, ExecucaoSerieRepository execucoes, PlanoTreinoRepository planos,
                         IndicesDeVersao indices, AtualizacaoService atualizacoes, PastaRepository pastas,
                         SessaoConcluidaRepository sessoesConcluidas, RetornoProperties retorno) {
        this.alunos = alunos;
        this.execucoes = execucoes;
        this.planos = planos;
        this.indices = indices;
        this.atualizacoes = atualizacoes;
        this.pastas = pastas;
        this.sessoesConcluidas = sessoesConcluidas;
        this.retorno = retorno;
    }

    @Transactional(readOnly = true)
    public PainelTreinador painel() {
        return painel(false, DIAS_SEM_REGISTRO_PADRAO);
    }

    @Transactional(readOnly = true)
    public PainelTreinador painel(boolean meus, int diasSemRegistro) {
        if (diasSemRegistro < 1 || diasSemRegistro > DIAS_SEM_REGISTRO_MAXIMO) {
            throw new BadRequestException("Dias sem registro precisa estar entre 1 e " + DIAS_SEM_REGISTRO_MAXIMO + ".");
        }
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        UUID responsavelId = meus ? ((br.com.treinos.api.security.UsuarioAutenticado)
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal()).usuarioId() : null;
        List<Aluno> ativos = alunos.ativosDoEscopo(responsavelId);
        Map<UUID, Aluno> porId = ativos.stream().collect(Collectors.toMap(Aluno::getId, Function.identity()));

        Map<UUID, LocalDate> ultimo = new HashMap<>();
        if (!ativos.isEmpty()) {
            execucoes.ultimoRegistro(porId.keySet()).forEach(u -> ultimo.put(u.alunoId(), u.data()));
        }
        List<Aluno> paradosHaDias = ativos.stream()
                .filter(a -> ultimo.get(a.getId()) == null || ultimo.get(a.getId()).isBefore(hoje.minusDays(diasSemRegistro)))
                .toList();
        List<AlunoSemRegistro> semRegistro = paradosHaDias.stream()
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
        // Uma leitura só para os quatro contadores; são os mesmos números das listas que a tela abre.
        Map<String,Long> contagem = checkin ? atualizacoes.contar(responsavelId) : Map.of();
        boolean treinos = br.com.treinos.api.equipe.AcessoAtual.pode("TREINO_LER");
        // Pastas a renovar: a contagem (sem teto) e a lista (até 20) saem da mesma consulta, então a regra é uma só.
        List<PastaPlano> aRenovar = treinos ? pastas.aRenovar(responsavelId, hoje.plusDays(DIAS_PARA_RENOVAR)) : List.of();
        List<PastaARenovar> listaARenovar = new ArrayList<>();
        for (PastaPlano p : aRenovar) {
            Aluno a = porId.get(p.getAlunoId());
            if (a != null && listaARenovar.size() < LIMITE_LISTA) {
                listaARenovar.add(new PastaARenovar(new PastaRef(p.getId(), p.getTitulo()),
                        new AlunoRef(a.getId(), a.getNome()), p.getFim()));
            }
        }
        // Contagens novas: só números, sem teto; null (nunca 0) quando o treinador não pode ver.
        Long semPasta = treinos ? semPastaComPeriodo(ativos, responsavelId) : null;
        Long semAcesso = ativos.stream().filter(a -> a.getUsuarioId() == null).count();
        // Mesma janela dos recordes da semana (hoje e os 6 dias antes); sem retorno ou sem REGISTRO_LER, null.
        Long concluidas = registros && retorno.habilitado() ? concluidasNa7Dias(ativos, hoje) : null;
        return new PainelTreinador(ativos.size(), registros ? semRegistro : List.of(), registros ? ultimasExecucoes(porId) : List.of(),
                treinos ? terminando : List.of(),
                contagem.getOrDefault("PARA_REVISAR",0L), contagem.getOrDefault("ATRASADAS",0L),
                contagem.getOrDefault("AVISARAM_ATRASO",0L), contagem.getOrDefault("PROXIMAS",0L),
                treinos ? Long.valueOf(aRenovar.size()) : null, listaARenovar, semPasta,
                registros ? Long.valueOf(paradosHaDias.size()) : null, semAcesso, concluidas);
    }

    private long concluidasNa7Dias(List<Aluno> ativos, LocalDate hoje) {
        if (ativos.isEmpty()) {
            return 0L;
        }
        return sessoesConcluidas.contarConcluidasDosAlunos(ativos.stream().map(Aluno::getId).toList(),
                hoje.minusDays(RecordesDaSemanaService.DIAS - 1L), hoje);
    }

    /**
     * Alunos ativos do escopo sem pasta vigente com período: os que a lista de atualizações (mesma consulta) não alcança.
     * É o grupo "Sem pasta com período" da lista de alunos do app.
     */
    private long semPastaComPeriodo(List<Aluno> ativos, UUID responsavelId) {
        if (ativos.isEmpty()) {
            return 0L;
        }
        java.util.Set<UUID> comPasta = atualizacoes.alunosComPastaVigente(responsavelId);
        return ativos.stream().filter(a -> !comPasta.contains(a.getId())).count();
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
