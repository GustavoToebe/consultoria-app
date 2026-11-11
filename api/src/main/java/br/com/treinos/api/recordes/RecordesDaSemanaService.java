package br.com.treinos.api.recordes;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.execucao.ExecucaoSerie;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.execucao.ExecucaoSerieRepository.MelhorRepeticao;
import br.com.treinos.api.execucao.IndiceVersao;
import br.com.treinos.api.execucao.IndicesDeVersao;
import br.com.treinos.api.recordes.RecordesPessoais.Marca;
import br.com.treinos.api.recordes.RecordesPessoais.Melhores;
import br.com.treinos.api.recordes.RecordesPessoais.Recorde;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * "Recordes da semana" do treinador (Engajamento 0.5, P3): as séries simples dos últimos 7 dias (hoje de Brasília
 * inclusive) que bateram recorde pessoal, pela mesma regra que o app usa para o aluno ({@link RecordesPessoais}). Nada é
 * gravado: é calculado a cada leitura a partir das séries registradas (duas consultas, por lotes de alunos: as do período e as
 * de antes dele, estas já agrupadas por carga com a maior repetição). Exercício fora da biblioteca nunca tem recorde. Sem 1RM (P7).
 */
@Service
public class RecordesDaSemanaService {

    /** Dias do período, hoje incluído. */
    public static final int DIAS = 7;
    /** Linhas devolvidas (as mais recentes); {@code total} diz quantas há. */
    static final int LIMITE = 50;

    /** Uma série com recorde: de quem, quando, em que exercício e o que bateu. */
    public record SerieComRecorde(UUID alunoId, String alunoNome, LocalDate data, UUID exercicioId, String exercicioNome,
                                  List<Recorde> recordes) {
    }

    /** O período ({@code de} a {@code ate}, inclusive), o total de séries com recorde e as mais recentes. */
    public record RecordesDaSemanaResponse(LocalDate de, LocalDate ate, int total, List<SerieComRecorde> series) {
    }

    private final ExecucaoSerieRepository execucoes;
    private final IndicesDeVersao indices;
    private final AlunoRepository alunos;

    public RecordesDaSemanaService(ExecucaoSerieRepository execucoes, IndicesDeVersao indices, AlunoRepository alunos) {
        this.execucoes = execucoes;
        this.indices = indices;
        this.alunos = alunos;
    }

    /** Alunos ativos da consultoria; com {@code responsavelId}, só os dele ("Meus alunos"), como o painel. */
    @Transactional(readOnly = true)
    public RecordesDaSemanaResponse daConsultoria(UUID responsavelId) {
        return calcular(alunos.ativosDoEscopo(responsavelId));
    }

    /** Um aluno (ativo ou não). Outra consultoria = 404. */
    @Transactional(readOnly = true)
    public RecordesDaSemanaResponse doAluno(UUID alunoId) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        return calcular(List.of(aluno));
    }

    private RecordesDaSemanaResponse calcular(List<Aluno> lista) {
        LocalDate ate = LocalDate.now(Fuso.BRASILIA);
        LocalDate de = ate.minusDays(DIAS - 1L);
        if (lista.isEmpty()) {
            return new RecordesDaSemanaResponse(de, ate, 0, List.of());
        }
        Map<UUID, Aluno> porId = lista.stream().collect(Collectors.toMap(Aluno::getId, a -> a));
        // Ids dos alunos em lotes (como a lista de alunos): o `in` não cresce sem limite com o escopo.
        List<List<UUID>> lotes = AlunoService.lotesDeIds(new ArrayList<>(porId.keySet()));
        List<ExecucaoSerie> doPeriodo = new ArrayList<>();
        for (List<UUID> lote : lotes) {
            execucoes.findByAlunoIdInAndConcluidaTrueAndCargaNotNullAndRepeticoesNotNullAndEtapasIsNullAndDataBetween(lote, de, ate)
                    .stream().filter(e -> e.getExercicioId() != null).forEach(doPeriodo::add);
        }
        if (doPeriodo.isEmpty()) {
            return new RecordesDaSemanaResponse(de, ate, 0, List.of());
        }
        Set<UUID> exercicios = doPeriodo.stream().map(ExecucaoSerie::getExercicioId).collect(Collectors.toSet());
        // As de antes do período já vêm agrupadas (a maior repetição por aluno, exercício, versão, série e carga).
        List<MelhorRepeticao> antes = new ArrayList<>();
        for (List<UUID> lote : lotes) {
            antes.addAll(execucoes.melhoresAntesDe(lote, exercicios, de));
        }
        Map<UUID, IndiceVersao> porVersao = indices.carregar(java.util.stream.Stream.concat(
                        doPeriodo.stream().map(ExecucaoSerie::getPlanoVersaoId), antes.stream().map(MelhorRepeticao::planoVersaoId))
                .distinct().toList());

        // Base: os melhores de antes do período, por aluno e exercício. Sem a versão no índice, entra (na dúvida só impede).
        Map<String, List<Marca>> marcasAntes = new HashMap<>();
        for (MelhorRepeticao m : antes) {
            if (IndiceVersao.simples(porVersao.get(m.planoVersaoId()), m.serieUid(), true) && RecordesPessoais.conta(m.carga(), m.repeticoes())) {
                marcasAntes.computeIfAbsent(chave(m.alunoId(), m.exercicioId()), k -> new ArrayList<>())
                        .add(new Marca(m.carga(), m.repeticoes()));
            }
        }
        Map<String, List<RecordesDaSemana.SerieDoPeriodo<ExecucaoSerie>>> noPeriodo = new HashMap<>();
        for (ExecucaoSerie e : doPeriodo) {
            IndiceVersao indice = porVersao.get(e.getPlanoVersaoId());
            // No período, só conta a série que se sabe simples; a outra entra como nula (não é recorde, não muda a base).
            Marca marca = IndiceVersao.simples(indice, e.getSerieUid(), false) && RecordesPessoais.conta(e.getCarga(), e.getRepeticoes())
                    ? new Marca(e.getCarga(), e.getRepeticoes()) : null;
            int ordem = indice == null ? 0 : indice.serie(e.getSerieUid()).map(IndiceVersao.LocalSerie::ordem).orElse(0);
            noPeriodo.computeIfAbsent(chave(e.getAlunoId(), e.getExercicioId()), k -> new ArrayList<>()).add(new RecordesDaSemana.SerieDoPeriodo<>(e.getData(), ordem, marca, e));
        }
        List<SerieComRecorde> resultado = new ArrayList<>();
        noPeriodo.forEach((chave, series) -> {
            Melhores base = marcasAntes.containsKey(chave) ? RecordesPessoais.melhores(marcasAntes.get(chave)) : null;
            for (RecordesDaSemana.ComRecorde<ExecucaoSerie> r : RecordesDaSemana.doPeriodo(base, series)) {
                ExecucaoSerie e = r.origem();
                IndiceVersao indice = porVersao.get(e.getPlanoVersaoId());
                resultado.add(new SerieComRecorde(e.getAlunoId(), porId.get(e.getAlunoId()).getNome(), r.data(), e.getExercicioId(),
                        indice == null ? "Exercício" : indice.nomeExercicio(e.getExercicioUid()), r.recordes()));
            }
        });
        resultado.sort(Comparator.comparing(SerieComRecorde::data).reversed()
                .thenComparing(SerieComRecorde::alunoNome, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(SerieComRecorde::exercicioNome, String.CASE_INSENSITIVE_ORDER));
        return new RecordesDaSemanaResponse(de, ate, resultado.size(), resultado.stream().limit(LIMITE).toList());
    }

    private static String chave(UUID alunoId, UUID exercicioId) {
        return alunoId + "|" + exercicioId;
    }
}
