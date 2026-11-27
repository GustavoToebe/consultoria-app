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
    public static final int DIAS_PARA_RENOVAR = 7;
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
     * Contagens de acompanhamento (sem registro, planos terminando, pastas a renovar, sem pasta com período) só contam
     * alunos com acesso ao app ({@code usuarioId} não nulo): quem não tem acesso não registra nem atualiza. {@code alunosAtivos},
     * {@code alunosSemAcesso} e {@code alunosInativos} seguem sobre todos. As quatro contagens de atualização também
     * só leem alunos com acesso ({@code AtualizacaoRepository.linhasDoPainel}, a mesma fonte da lista que o cartão abre).
     * As quatro contagens de atualização ({@code atualizacoesParaRevisar}, {@code atualizacoesAtrasadas},
     * {@code atualizacoesAvisaramAtraso}, {@code atualizacoesProximas}) são {@code null} (nunca zero) sem
     * {@code ATUALIZACAO_LER} + {@code ALUNO_SENSIVEL_LER}, como o {@code NumerosService}; com elas, zero é zero de verdade.
     * {@code sessoesConcluidas7Dias}: sessões concluídas (completas e parciais) dos alunos do escopo nos últimos
     * {@value RecordesDaSemanaService#DIAS} dias (hoje de Brasília incluído), só número; {@code null} (nunca zero) sem
     * {@code REGISTRO_LER} ou com o retorno desligado ({@code treinos.retorno.habilitado}).
     * {@code alunosInativos}: alunos inativos e não anonimizados do mesmo escopo ({@code meus}), só o número; como o
     * {@code alunosAtivos}, nunca é nulo nem pede permissão além da {@code PAINEL_VER} da rota.
     */
    public record PainelTreinador(long alunosAtivos, List<AlunoSemRegistro> alunosSemRegistro,
                                  List<ExecucaoRecente> ultimasExecucoes, List<PlanoTerminando> planosTerminando,
                                  Long atualizacoesParaRevisar, Long atualizacoesAtrasadas,
                                  Long atualizacoesAvisaramAtraso, Long atualizacoesProximas,
                                  Long pastasARenovar, List<PastaARenovar> pastasParaRenovar,
                                  Long alunosSemPastaComPeriodo, Long alunosSemRegistroTotal, Long alunosSemAcesso,
                                  Long sessoesConcluidas7Dias, long alunosInativos) {
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
        // Acompanhamento só conta quem tem acesso ao app: sem acesso não registra nem atualiza (os convites são o passo certo).
        List<Aluno> acompanhados = ativos.stream().filter(a -> a.getUsuarioId() != null).toList();
        Map<UUID, Aluno> acompanhadosPorId = acompanhados.stream().collect(Collectors.toMap(Aluno::getId, Function.identity()));

        Map<UUID, LocalDate> ultimo = new HashMap<>();
        if (!acompanhados.isEmpty()) {
            execucoes.ultimoRegistro(acompanhadosPorId.keySet()).forEach(u -> ultimo.put(u.alunoId(), u.data()));
        }
        List<Aluno> paradosHaDias = acompanhados.stream()
                .filter(a -> ultimo.get(a.getId()) == null || ultimo.get(a.getId()).isBefore(hoje.minusDays(diasSemRegistro)))
                .toList();
        List<AlunoSemRegistro> semRegistro = paradosHaDias.stream()
                .limit(LIMITE_LISTA)
                .map(a -> new AlunoSemRegistro(a.getId(), a.getNome(), ultimo.get(a.getId())))
                .toList();

        List<PlanoTerminando> terminando = new ArrayList<>();
        List<PlanoTreino> vigentesQueTerminam = planos.findByAtivoTrueAndFimBetweenOrderByFimAsc(hoje, hoje.plusDays(7));
        // Sucessor agendado (V106): o vigente sai da lista se há OUTRO plano de treino agendado do mesmo aluno liberado até o dia
        // seguinte ao fim dele (a nova versão agendada do próprio vigente não é sucessor) (dias de Brasília). Liberado depois disso, o vigente continua listado (haverá intervalo sem plano).
        Map<UUID, List<PlanoTreino>> agendados = new HashMap<>();
        if (!vigentesQueTerminam.isEmpty()) {
            planos.agendadosDosAlunos(vigentesQueTerminam.stream().map(PlanoTreino::getAlunoId).distinct().toList())
                    .forEach(s -> agendados.computeIfAbsent(s.getAlunoId(), k -> new ArrayList<>()).add(s));
        }
        for (PlanoTreino p : vigentesQueTerminam) {
            boolean temSucessor = agendados.getOrDefault(p.getAlunoId(), List.of()).stream()
                    .anyMatch(s -> !s.getId().equals(p.getId()) && !s.getLiberarEm().isAfter(p.getFim().plusDays(1)));
            Aluno a = acompanhadosPorId.get(p.getAlunoId());
            if (a != null && !temSucessor && terminando.size() < LIMITE_LISTA) {
                terminando.add(new PlanoTerminando(new PlanoRef(p.getId(), p.getTitulo()),
                        new AlunoRef(a.getId(), a.getNome()), p.getFim()));
            }
        }
        boolean registros = br.com.treinos.api.equipe.AcessoAtual.pode("REGISTRO_LER");
        boolean checkin = br.com.treinos.api.equipe.AcessoAtual.pode("ATUALIZACAO_LER")
                && br.com.treinos.api.equipe.AcessoAtual.pode("ALUNO_SENSIVEL_LER");
        boolean treinos = br.com.treinos.api.equipe.AcessoAtual.pode("TREINO_LER");
        // Uma leitura só para os quatro contadores e para "sem pasta com período"; são os mesmos números das listas que a tela abre.
        AtualizacaoService.LeituraDoPainel leitura = checkin || (treinos && !ativos.isEmpty())
                ? atualizacoes.leituraDoPainel(responsavelId) : null;
        Map<String,Long> contagem = checkin ? leitura.contagem() : Map.of();
        // Pastas a renovar: a contagem (sem teto) e a lista (até 20) saem da mesma consulta, então a regra é uma só.
        // Só de aluno com acesso: a contagem e a lista saem do mesmo filtro, então o cartão e a Folha batem.
        List<PastaPlano> aRenovar = treinos ? pastas.aRenovar(responsavelId, hoje.plusDays(DIAS_PARA_RENOVAR)).stream()
                .filter(p -> acompanhadosPorId.containsKey(p.getAlunoId())).toList() : List.of();
        List<PastaARenovar> listaARenovar = new ArrayList<>();
        for (PastaPlano p : aRenovar) {
            Aluno a = acompanhadosPorId.get(p.getAlunoId());
            if (a != null && listaARenovar.size() < LIMITE_LISTA) {
                listaARenovar.add(new PastaARenovar(new PastaRef(p.getId(), p.getTitulo()),
                        new AlunoRef(a.getId(), a.getNome()), p.getFim()));
            }
        }
        // Contagens novas: só números, sem teto; null (nunca 0) quando o treinador não pode ver.
        Long semPasta = treinos ? semPastaComPeriodo(acompanhados, leitura) : null;
        Long semAcesso = ativos.stream().filter(a -> a.getUsuarioId() == null).count();
        // Mesma janela dos recordes da semana (hoje e os 6 dias antes); sem retorno ou sem REGISTRO_LER, null.
        Long concluidas = registros && retorno.habilitado() ? concluidasNa7Dias(ativos, hoje) : null;
        return new PainelTreinador(ativos.size(), registros ? semRegistro : List.of(), registros ? ultimasExecucoes(porId) : List.of(),
                treinos ? terminando : List.of(),
                contagem.get("PARA_REVISAR"), contagem.get("ATRASADAS"),
                contagem.get("AVISARAM_ATRASO"), contagem.get("PROXIMAS"),
                treinos ? Long.valueOf(aRenovar.size()) : null, listaARenovar, semPasta,
                registros ? Long.valueOf(paradosHaDias.size()) : null, semAcesso, concluidas,
                alunos.contarInativosNaoAnonimizadosDoEscopo(responsavelId));
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
    private long semPastaComPeriodo(List<Aluno> ativos, AtualizacaoService.LeituraDoPainel leitura) {
        if (ativos.isEmpty()) {
            return 0L;
        }
        java.util.Set<UUID> comPasta = leitura.alunosComPastaVigente();
        return ativos.stream().filter(a -> !comPasta.contains(a.getId())).count();
    }

    /** Agrupa os registros mais recentes por aluno, dia e sessão. Só alunos ativos do escopo: o filtro vai na consulta, não depois do teto de 300. */
    private List<ExecucaoRecente> ultimasExecucoes(Map<UUID, Aluno> porId) {
        if (porId.isEmpty()) {
            return List.of();
        }
        List<ExecucaoSerie> recentes = execucoes.findTop300ByAlunoIdInOrderByRecebidoEmDesc(porId.keySet());
        Map<UUID, IndiceVersao> indice = indices.carregar(recentes.stream()
                .map(ExecucaoSerie::getPlanoVersaoId).distinct().toList());
        record Grupo(UUID alunoId, LocalDate data, UUID sessaoUid, UUID versaoId) {
        }
        Map<Grupo, Integer> grupos = new LinkedHashMap<>();
        for (ExecucaoSerie e : recentes) {
            grupos.merge(new Grupo(e.getAlunoId(), e.getData(), e.getSessaoUid(), e.getPlanoVersaoId()), 1, Integer::sum);
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
