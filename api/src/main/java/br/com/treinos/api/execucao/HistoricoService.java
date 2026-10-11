package br.com.treinos.api.execucao;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.DiaDeTreino;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ExercicioFeito;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.ProgressoPonto;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.SerieFeita;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.SessaoFeita;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.UltimaCarga;
import br.com.treinos.api.web.BadRequestException;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Leituras dos registros: histórico agrupado (data → sessão → exercício → séries, na ordem do plano), progresso por
 * exercício (maior carga de trabalho do dia) e a última carga de trabalho de cada exercício, que vira a sugestão do
 * aluno. Só mostra o que foi registrado: nada é estimado.
 */
@Service
public class HistoricoService {

    private static final int PERIODO_MAXIMO_DIAS = 366;

    private final ExecucaoSerieRepository execucoes;
    private final IndicesDeVersao indices;
    private final AlunoRepository alunos;
    private final ExercicioRepository biblioteca;

    public HistoricoService(ExecucaoSerieRepository execucoes, IndicesDeVersao indices, AlunoRepository alunos,
                            ExercicioRepository biblioteca) {
        this.biblioteca = biblioteca;
        this.execucoes = execucoes;
        this.indices = indices;
        this.alunos = alunos;
    }

    /**
     * Treinador: confere que o aluno é da consultoria (404 se não for). A observação da série é dado sensível: sem
     * {@code ALUNO_SENSIVEL_LER} ela sai nula (o aluno continua vendo a própria, por {@link #historico}).
     */
    @Transactional(readOnly = true)
    public List<DiaDeTreino> doAluno(UUID alunoId, LocalDate de, LocalDate ate) {
        exigirAluno(alunoId);
        return montar(alunoId, de, ate, AcessoAtual.pode("ALUNO_SENSIVEL_LER"));
    }

    @Transactional(readOnly = true)
    public List<DiaDeTreino> historico(UUID alunoId, LocalDate de, LocalDate ate) {
        return montar(alunoId, de, ate, true);
    }

    private List<DiaDeTreino> montar(UUID alunoId, LocalDate de, LocalDate ate, boolean comObservacao) {
        LocalDate fim = ate == null ? LocalDate.now(Fuso.BRASILIA) : ate;
        LocalDate inicio = de == null ? fim.minusDays(13) : de;
        if (inicio.isAfter(fim) || ChronoUnit.DAYS.between(inicio, fim) > PERIODO_MAXIMO_DIAS) {
            throw new BadRequestException("Período inválido (até 1 ano).");
        }
        List<ExecucaoSerie> lista = execucoes.findByAlunoIdAndDataBetweenOrderByDataDesc(alunoId, inicio, fim);
        // Biblioteca filtrada pela consultoria da sessão (@TenantId).
        Map<UUID, String> grupos = new HashMap<>();
        biblioteca.findAllById(lista.stream().map(ExecucaoSerie::getExercicioId).filter(java.util.Objects::nonNull).distinct().toList())
                .forEach(e -> { if (e.getGrupoMuscular() != null) grupos.put(e.getId(), e.getGrupoMuscular()); });
        return agrupar(lista, indices.carregar(lista.stream().map(ExecucaoSerie::getPlanoVersaoId).distinct().toList()), grupos,
                comObservacao);
    }

    @Transactional(readOnly = true)
    public List<ProgressoPonto> progresso(UUID alunoId, UUID exercicioId) {
        exigirAluno(alunoId);
        Map<LocalDate, ProgressoPonto> porDia = new LinkedHashMap<>();
        for (ExecucaoSerie e : execucoes
                .findByAlunoIdAndExercicioIdAndSerieTrabalhoTrueAndCargaNotNullOrderByDataAsc(alunoId, exercicioId)) {
            ProgressoPonto atual = porDia.get(e.getData());
            if (atual == null || e.getCarga().compareTo(atual.maiorCargaTrabalho()) > 0) {
                porDia.put(e.getData(), new ProgressoPonto(e.getData(), e.getCarga(), e.getRepeticoes()));
            }
        }
        return new ArrayList<>(porDia.values());
    }

    /** Última carga de trabalho de cada exercício (maior carga do dia mais recente). Sem histórico, o exercício fica de fora. */
    @Transactional(readOnly = true)
    public Map<UUID, UltimaCarga> ultimasCargas(UUID alunoId, Collection<UUID> exercicioIds) {
        Map<UUID, UltimaCarga> mapa = new HashMap<>();
        if (exercicioIds.isEmpty()) {
            return mapa;
        }
        for (ExecucaoSerie e : execucoes
                .findByAlunoIdAndExercicioIdInAndSerieTrabalhoTrueAndCargaNotNullOrderByDataDesc(alunoId, exercicioIds)) {
            UltimaCarga atual = mapa.get(e.getExercicioId());
            if (atual == null) {
                mapa.put(e.getExercicioId(), new UltimaCarga(e.getCarga(), e.getRepeticoes(), e.getData()));
            } else if (atual.data().equals(e.getData()) && e.getCarga().compareTo(atual.carga()) > 0) {
                mapa.put(e.getExercicioId(), new UltimaCarga(e.getCarga(), e.getRepeticoes(), e.getData()));
            }
        }
        return mapa;
    }

    static List<DiaDeTreino> agrupar(List<ExecucaoSerie> lista, Map<UUID, IndiceVersao> indices, Map<UUID, String> grupos,
                                     boolean comObservacao) {
        Map<LocalDate, Map<UUID, List<ExecucaoSerie>>> porDia = new LinkedHashMap<>();
        for (ExecucaoSerie e : lista) {
            porDia.computeIfAbsent(e.getData(), d -> new LinkedHashMap<>())
                    .computeIfAbsent(e.getSessaoUid(), s -> new ArrayList<>()).add(e);
        }
        List<DiaDeTreino> dias = new ArrayList<>();
        porDia.forEach((data, sessoes) -> {
            List<SessaoFeita> feitas = new ArrayList<>();
            sessoes.forEach((sessaoUid, series) -> {
                IndiceVersao indice = indices.get(series.get(0).getPlanoVersaoId());
                series.sort(Comparator.comparingInt(e -> ordem(indice, e)));
                Map<UUID, List<SerieFeita>> porExercicio = new LinkedHashMap<>();
                Map<UUID, UUID> exercicioIds = new HashMap<>();
                for (ExecucaoSerie e : series) {
                    exercicioIds.put(e.getExercicioUid(), e.getExercicioId());
                    String tipo = indice == null ? null : indice.serie(e.getSerieUid())
                            .map(IndiceVersao.LocalSerie::tipo).orElse(null);
                    porExercicio.computeIfAbsent(e.getExercicioUid(), x -> new ArrayList<>())
                            .add(new SerieFeita(e.getId(), e.getSerieUid(), tipo, e.isSerieTrabalho(), e.getCarga(),
                                    e.getUnidade(), e.getRepeticoes(), e.isConcluida(), comObservacao ? e.getObservacao() : null));
                }
                List<ExercicioFeito> exercicios = new ArrayList<>();
                porExercicio.forEach((exercicioUid, feitas2) -> exercicios.add(new ExercicioFeito(exercicioUid,
                        exercicioIds.get(exercicioUid),
                        indice == null ? "Exercício" : indice.nomeExercicio(exercicioUid),
                        grupos.get(exercicioIds.get(exercicioUid)), feitas2)));
                feitas.add(new SessaoFeita(sessaoUid, indice == null ? "Sessão" : indice.nomeSessao(sessaoUid),
                        series.get(0).getPlanoVersaoId(), exercicios));
            });
            dias.add(new DiaDeTreino(data, feitas));
        });
        return dias;
    }

    private static int ordem(IndiceVersao indice, ExecucaoSerie e) {
        return indice == null ? 0 : indice.serie(e.getSerieUid()).map(IndiceVersao.LocalSerie::ordem).orElse(0);
    }

    private void exigirAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
    }
}
