package br.com.treinos.api.recordes;

import br.com.treinos.api.execucao.ExecucaoSerie;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.execucao.IndiceVersao;
import br.com.treinos.api.execucao.IndicesDeVersao;
import br.com.treinos.api.recordes.RecordesPessoais.Marca;
import br.com.treinos.api.recordes.RecordesPessoais.Melhores;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Os melhores valores de cada exercício do plano, para o pacote do aluno (Engajamento 0.2, P10): com eles o app decide
 * na hora, sem internet, se a série que o aluno acabou de marcar é recorde pessoal. Só entra o que foi feito
 * <b>antes de hoje</b> (Brasília, {@code ate}): as séries de hoje o app compara entre si, na ordem do plano, e o pacote
 * baixado de novo no meio do treino não apaga as medalhas do dia. Nada é gravado nem estimado.
 */
@Service
public class RecordesService {

    /** O que vai no pacote: o corte ({@code ate}, exclusivo) e os melhores por exercício da biblioteca. */
    public record RecordesDoPacote(LocalDate ate, Map<UUID, Melhores> exercicios) {
    }

    private final ExecucaoSerieRepository execucoes;
    private final IndicesDeVersao indices;

    public RecordesService(ExecucaoSerieRepository execucoes, IndicesDeVersao indices) {
        this.execucoes = execucoes;
        this.indices = indices;
    }

    /** Exercício sem nenhuma série simples antes de hoje fica de fora do mapa (o app então não comemora: primeiro registro). */
    @Transactional(readOnly = true)
    public RecordesDoPacote doPacote(UUID alunoId, Collection<UUID> exercicioIds) {
        return doPacote(alunoId, exercicioIds, true);
    }

    private RecordesDoPacote doPacote(UUID alunoId, Collection<UUID> exercicioIds, boolean naDuvida) {
        LocalDate ate = LocalDate.now(Fuso.BRASILIA);
        Map<UUID, Melhores> mapa = new HashMap<>();
        if (exercicioIds.isEmpty()) {
            return new RecordesDoPacote(ate, mapa);
        }
        List<ExecucaoSerie> lista = execucoes
                .findByAlunoIdAndExercicioIdInAndConcluidaTrueAndCargaNotNullAndRepeticoesNotNullAndEtapasIsNullAndDataBefore(
                        alunoId, exercicioIds, ate);
        Map<UUID, IndiceVersao> porVersao = indices.carregar(lista.stream().map(ExecucaoSerie::getPlanoVersaoId).distinct().toList());
        Map<UUID, List<Marca>> marcas = new HashMap<>();
        for (ExecucaoSerie e : lista) {
            if (simples(porVersao.get(e.getPlanoVersaoId()), e, naDuvida) && RecordesPessoais.conta(e.getCarga(), e.getRepeticoes())) {
                marcas.computeIfAbsent(e.getExercicioId(), x -> new ArrayList<>()).add(new Marca(e.getCarga(), e.getRepeticoes()));
            }
        }
        marcas.forEach((exercicioId, doExercicio) -> mapa.put(exercicioId, RecordesPessoais.melhores(doExercicio)));
        return new RecordesDoPacote(ate, mapa);
    }

    /** Maior carga levantada (kg) num exercício da biblioteca. */
    public record MaiorCarga(UUID exercicioId, BigDecimal carga) {
    }

    /**
     * As maiores cargas do aluno, uma por exercício, da maior para a menor (empate pelo id do exercício), no máximo {@code limite}.
     * Reaproveita {@link #doPacote}: as mesmas séries simples e a mesma regra de antes de hoje, sem conta nova, mas estrita: o que
     * o colega vê só sai de série que o índice da versão confirma simples (sem índice ou série fora dele, a série não entra).
     * Só carga levantada, nunca data, série, treino nem repetições.
     */
    @Transactional(readOnly = true)
    public List<MaiorCarga> maioresCargas(UUID alunoId, int limite) {
        return doPacote(alunoId, execucoes.exerciciosComSerieFeita(alunoId), false).exercicios().entrySet().stream()
                .map(e -> new MaiorCarga(e.getKey(), e.getValue().maiorCarga()))
                .sorted(Comparator.comparing(MaiorCarga::carga).reversed().thenComparing(MaiorCarga::exercicioId))
                .limit(limite).toList();
    }

    /**
     * Série simples pela versão executada. Sem a versão ou a série no índice (não deveria acontecer) vale {@code naDuvida}: o
     * pacote do próprio aluno aceita (na dúvida a série só impede uma comemoração), a carga que outro aluno vê não aceita.
     */
    private static boolean simples(IndiceVersao indice, ExecucaoSerie e, boolean naDuvida) {
        return indice == null ? naDuvida : indice.serie(e.getSerieUid()).map(IndiceVersao.LocalSerie::simples).orElse(naDuvida);
    }
}
