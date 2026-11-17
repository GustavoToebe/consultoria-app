package br.com.treinos.api.execucao;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ChaveDaTroca;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ExercicioDaTroca;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TrocaDeExercicio;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TrocaPendente;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TrocasDeExercicio;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.TrocasPendentes;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.VistoDaTroca;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Trocas "só hoje" que um aluno fez, para o treinador (plano {@code docs/planos/trocar-exercicio.md} e
 * {@code alertas-de-troca.md}). Não há tabela de troca: ela é lida das séries concluídas, quando o
 * {@code execucao_serie.exercicio_id} é o de uma alternativa e não o do exercício na versão que o aluno executou. Só
 * leitura e só nomes de exercício, nunca carga, repetições nem observação. Janela padrão de 7 dias, no máximo 31.
 *
 * <p>O único dado gravado é o "Visto" do treinador ({@code troca_exercicio_visto}, V080), pela chave natural da troca
 * derivada: aluno + dia + versão + exercício do plano (uid) + alternativa usada. A pendência do Início é a troca dos últimos
 * 7 dias, de aluno ativo, sem visto: calculada a cada leitura, sem fila nem push.</p>
 */
@Service
public class TrocasDeExercicioService {

    static final int JANELA_PADRAO_DIAS = 7;
    static final int JANELA_MAXIMA_DIAS = 31;
    /** Linhas devolvidas nas pendências (as mais recentes); {@code total} diz quantas há. */
    static final int LIMITE_PENDENTES = 50;

    /** Uma troca lida das séries, com o aluno (a resposta de um aluno só não o repete). */
    private record TrocaLida(UUID alunoId, TrocaDeExercicio troca) {
    }

    private final ExecucaoSerieRepository execucoes;
    private final IndicesDeVersao indices;
    private final AlunoRepository alunos;
    private final TrocaExercicioVistoRepository vistos;

    public TrocasDeExercicioService(ExecucaoSerieRepository execucoes, IndicesDeVersao indices, AlunoRepository alunos,
                                    TrocaExercicioVistoRepository vistos) {
        this.execucoes = execucoes;
        this.indices = indices;
        this.alunos = alunos;
        this.vistos = vistos;
    }

    /** Aluno de outra consultoria = 404. Do mais recente ao mais antigo, com o {@code vistoEm} de cada troca. */
    @Transactional(readOnly = true)
    public TrocasDeExercicio doAluno(UUID alunoId, LocalDate de, LocalDate ate) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
        LocalDate fim = ate == null ? LocalDate.now(Fuso.BRASILIA) : ate;
        LocalDate inicio = de == null ? fim.minusDays(JANELA_PADRAO_DIAS - 1L) : de;
        if (inicio.isAfter(fim)) {
            throw new BadRequestException("A data final vem antes da inicial.", "PERIODO_INVALIDO");
        }
        if (ChronoUnit.DAYS.between(inicio, fim) >= JANELA_MAXIMA_DIAS) {
            throw new BadRequestException("Escolha um período de até " + JANELA_MAXIMA_DIAS + " dias.", "PERIODO_INVALIDO");
        }
        List<UUID> ids = List.of(alunoId);
        Map<String, Instant> vistoEm = vistoEmPorChave(ids, inicio, fim);
        return new TrocasDeExercicio(inicio, fim, ler(ids, inicio, fim).stream().map(t -> comVisto(t, vistoEm)).toList());
    }

    /**
     * Pendências do escopo: trocas dos últimos 7 dias (hoje de Brasília inclusive) ainda sem "Visto", de alunos ativos; com
     * {@code responsavelId}, só os dele ("Meus alunos", {@code AlunoRepository.ativosDoEscopo}). Só nomes de aluno e de
     * exercícios, o que o {@code REGISTRO_LER} já mostra.
     */
    @Transactional(readOnly = true)
    public TrocasPendentes pendentes(UUID responsavelId) {
        LocalDate ate = LocalDate.now(Fuso.BRASILIA);
        LocalDate de = ate.minusDays(JANELA_PADRAO_DIAS - 1L);
        Map<UUID, Aluno> porId = alunos.ativosDoEscopo(responsavelId).stream().collect(Collectors.toMap(Aluno::getId, a -> a));
        if (porId.isEmpty()) {
            return new TrocasPendentes(de, ate, 0, List.of());
        }
        List<UUID> ids = new ArrayList<>(porId.keySet());
        Map<String, Instant> vistoEm = vistoEmPorChave(ids, de, ate);
        List<TrocaPendente> pendentes = ler(ids, de, ate).stream()
                .map(t -> new TrocaPendente(t.alunoId(), porId.get(t.alunoId()).getNome(), comVisto(t, vistoEm)))
                .filter(p -> p.troca().vistoEm() == null)
                .sorted(Comparator.comparing((TrocaPendente p) -> p.troca().data()).reversed()
                        .thenComparing(TrocaPendente::alunoNome, String.CASE_INSENSITIVE_ORDER))
                .toList();
        return new TrocasPendentes(de, ate, pendentes.size(), pendentes.stream().limit(LIMITE_PENDENTES).toList());
    }

    /**
     * Marca "Visto" (alertas-de-troca, {@code REGISTRO_REAGIR}). Idempotente: marcar de novo devolve o que já estava. Aluno ou
     * troca (nos últimos 31 dias) que não existe, ou de outra consultoria = 404. O aluno fica travado até o fim, então duas
     * marcações ao mesmo tempo não duplicam.
     */
    @Transactional
    public VistoDaTroca marcarVisto(UUID alunoId, ChaveDaTroca chave, UUID usuarioId) {
        exigirTroca(alunoId, chave);
        // Microssegundos, a precisão do timestamptz: a primeira resposta (da memória) e a repetição (do banco) coincidem.
        TrocaExercicioVisto visto = daTroca(alunoId, chave).orElseGet(() -> vistos.save(new TrocaExercicioVisto(alunoId,
                chave.data(), chave.planoVersaoId(), chave.exercicioUid(), chave.alternativaId(), usuarioId,
                Instant.now().truncatedTo(ChronoUnit.MICROS))));
        return new VistoDaTroca(visto.getVistoEm());
    }

    /** Desfaz o "Visto" (toque errado). Sem marca, nada muda; mesmas recusas do {@link #marcarVisto}. */
    @Transactional
    public void desmarcarVisto(UUID alunoId, ChaveDaTroca chave) {
        exigirTroca(alunoId, chave);
        daTroca(alunoId, chave).ifPresent(vistos::delete);
    }

    private Optional<TrocaExercicioVisto> daTroca(UUID alunoId, ChaveDaTroca c) {
        return vistos.daTroca(alunoId, c.data(), c.planoVersaoId(), c.exercicioUid(), c.alternativaId());
    }

    /** Trava o aluno (404 se não é da consultoria) e confere que a troca ainda existe nas séries daquele dia. */
    private void exigirTroca(UUID alunoId, ChaveDaTroca c) {
        Exigir.existe(alunos.buscarParaAlterar(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        boolean existe = !c.data().isAfter(hoje) && ChronoUnit.DAYS.between(c.data(), hoje) < JANELA_MAXIMA_DIAS
                && ler(List.of(alunoId), c.data(), c.data()).stream().anyMatch(t ->
                        t.troca().planoVersaoId().equals(c.planoVersaoId()) && t.troca().exercicioUid().equals(c.exercicioUid())
                                && t.troca().alternativa().exercicioId().equals(c.alternativaId()));
        if (!existe) {
            throw new NaoEncontradoException("Troca de exercício não encontrada.");
        }
    }

    /** As trocas do período dos alunos (em lotes), pela chave natural: séries da mesma troca viram uma só, com a contagem. */
    private List<TrocaLida> ler(List<UUID> alunoIds, LocalDate inicio, LocalDate fim) {
        List<ExecucaoSerie> feitas = new ArrayList<>();
        for (List<UUID> lote : AlunoService.lotesDeIds(alunoIds)) {
            feitas.addAll(execucoes.findByAlunoIdInAndConcluidaTrueAndExercicioIdIsNotNullAndDataBetweenOrderByDataDescIdAsc(lote, inicio, fim));
        }
        Map<UUID, IndiceVersao> porVersao = indices.carregar(feitas.stream().map(ExecucaoSerie::getPlanoVersaoId).distinct().toList());
        Map<String, TrocaLida> trocas = new LinkedHashMap<>();
        for (ExecucaoSerie e : feitas) {
            IndiceVersao indice = porVersao.get(e.getPlanoVersaoId());
            IndiceVersao.LocalSerie local = indice == null ? null : indice.serie(e.getSerieUid()).orElse(null);
            if (local == null || Objects.equals(local.exercicioId(), e.getExercicioId())) {
                continue;
            }
            String chave = chave(e.getAlunoId(), e.getData(), e.getPlanoVersaoId(), e.getExercicioUid(), e.getExercicioId());
            TrocaLida atual = trocas.get(chave);
            trocas.put(chave, new TrocaLida(e.getAlunoId(), new TrocaDeExercicio(e.getData(), e.getPlanoVersaoId(), e.getSessaoUid(),
                    indice.nomeSessao(e.getSessaoUid()), e.getExercicioUid(),
                    new ExercicioDaTroca(local.exercicioId(), indice.nomeExercicio(e.getExercicioUid())),
                    new ExercicioDaTroca(e.getExercicioId(), indice.nomeExercicio(e.getExercicioUid(), e.getExercicioId())),
                    atual == null ? 1 : atual.troca().series() + 1, null)));
        }
        return List.copyOf(trocas.values());
    }

    /** Quando cada troca foi vista no período, pela mesma chave de {@link #ler}. */
    private Map<String, Instant> vistoEmPorChave(List<UUID> alunoIds, LocalDate de, LocalDate ate) {
        Map<String, Instant> vistoEm = new HashMap<>();
        for (List<UUID> lote : AlunoService.lotesDeIds(alunoIds)) {
            vistos.doPeriodo(lote, de, ate).forEach(v -> vistoEm.put(
                    chave(v.getAlunoId(), v.getData(), v.getPlanoVersaoId(), v.getExercicioUid(), v.getAlternativaId()), v.getVistoEm()));
        }
        return vistoEm;
    }

    private static TrocaDeExercicio comVisto(TrocaLida l, Map<String, Instant> vistoEm) {
        TrocaDeExercicio t = l.troca();
        Instant quando = vistoEm.get(chave(l.alunoId(), t.data(), t.planoVersaoId(), t.exercicioUid(), t.alternativa().exercicioId()));
        return new TrocaDeExercicio(t.data(), t.planoVersaoId(), t.sessaoUid(), t.sessao(), t.exercicioUid(), t.principal(),
                t.alternativa(), t.series(), quando);
    }

    /** Aluno + dia + versão + exercício do plano + alternativa: a troca, igual nas séries e no visto. */
    private static String chave(UUID alunoId, LocalDate data, UUID planoVersaoId, UUID exercicioUid, UUID alternativaId) {
        return alunoId + "|" + data + "|" + planoVersaoId + "|" + exercicioUid + "|" + alternativaId;
    }
}
