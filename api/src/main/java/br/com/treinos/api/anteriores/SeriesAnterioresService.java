package br.com.treinos.api.anteriores;

import br.com.treinos.api.anteriores.SeriesAnteriores.AnteriorDoExercicio;
import br.com.treinos.api.anteriores.SeriesAnteriores.Feita;
import br.com.treinos.api.execucao.ExecucaoSerie;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.execucao.IndiceVersao;
import br.com.treinos.api.execucao.IndicesDeVersao;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.EtapaRegistrada;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * A última vez de cada exercício do plano, para o pacote do aluno (Engajamento 0.3): com ela o app mostra a coluna
 * "Anterior" de cada série sem internet. Como os recordes (0.2), só entra o que foi feito <b>antes de hoje</b>
 * (Brasília, {@code ate}): o que o aluno marca hoje o app já conhece. Duas consultas fixas: a data da última vez de
 * cada exercício e as séries feitas nessas datas. Nada é gravado nem estimado.
 */
@Service
public class SeriesAnterioresService {

    /** O que vai no pacote: o corte ({@code ate}, exclusivo) e a última vez de cada exercício da biblioteca. */
    public record AnterioresDoPacote(LocalDate ate, Map<UUID, AnteriorDoExercicio> exercicios) {
    }

    private final ExecucaoSerieRepository execucoes;
    private final IndicesDeVersao indices;
    private final JsonMapper json;

    public SeriesAnterioresService(ExecucaoSerieRepository execucoes, IndicesDeVersao indices, JsonMapper json) {
        this.execucoes = execucoes;
        this.indices = indices;
        this.json = json;
    }

    /** Exercício nunca feito antes de hoje fica de fora do mapa (o app mostra "—"). */
    @Transactional(readOnly = true)
    public AnterioresDoPacote doPacote(UUID alunoId, Collection<UUID> exercicioIds) {
        LocalDate ate = LocalDate.now(Fuso.BRASILIA);
        if (exercicioIds.isEmpty()) {
            return new AnterioresDoPacote(ate, Map.of());
        }
        Map<UUID, LocalDate> ultimaVez = new HashMap<>();
        for (ExecucaoSerieRepository.UltimaVez u : execucoes.ultimaVezDosExercicios(alunoId, exercicioIds, ate)) {
            ultimaVez.put(u.exercicioId(), u.data());
        }
        if (ultimaVez.isEmpty()) {
            return new AnterioresDoPacote(ate, Map.of());
        }
        Set<LocalDate> datas = new HashSet<>(ultimaVez.values());
        List<ExecucaoSerie> lista = execucoes.findByAlunoIdAndExercicioIdInAndConcluidaTrueAndDataIn(alunoId, ultimaVez.keySet(), datas)
                .stream().filter(e -> e.getData().equals(ultimaVez.get(e.getExercicioId()))).toList();
        Map<UUID, IndiceVersao> porVersao = indices.carregar(lista.stream().map(ExecucaoSerie::getPlanoVersaoId).distinct().toList());
        List<Feita> feitas = new ArrayList<>();
        for (ExecucaoSerie e : lista) {
            IndiceVersao indice = porVersao.get(e.getPlanoVersaoId());
            if (indice == null) {
                continue;
            }
            indice.serie(e.getSerieUid()).ifPresent(local -> feitas.add(new Feita(e.getExercicioId(), e.getData(),
                    e.getExercicioUid(), local.ordem(), local.codigo(), local.ordemNoTipo(), e.getCarga(), e.getRepeticoes(),
                    lerEtapas(e.getEtapas()))));
        }
        return new AnterioresDoPacote(ate, SeriesAnteriores.escolher(feitas));
    }

    /** Etapas gravadas pelo upsert (já conferidas e em ordem); nulo = série registrada inteira. */
    private List<EtapaRegistrada> lerEtapas(String etapas) {
        return etapas == null ? null : List.of(json.readValue(etapas, EtapaRegistrada[].class));
    }
}
