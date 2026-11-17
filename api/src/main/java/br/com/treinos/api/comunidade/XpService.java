package br.com.treinos.api.comunidade;

import br.com.treinos.api.comunidade.RegrasXp.RecordeDoDia;
import br.com.treinos.api.comunidade.RegrasXp.SemanaDoPlano;
import br.com.treinos.api.comunidade.RegrasXp.SessaoDoDia;
import br.com.treinos.api.comunidade.RegrasXp.Xp;
import br.com.treinos.api.execucao.ExecucaoSerie;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.execucao.IndiceVersao;
import br.com.treinos.api.execucao.IndiceVersao.LocalSerie;
import br.com.treinos.api.execucao.IndicesDeVersao;
import br.com.treinos.api.recordes.RecordesDaSemana;
import br.com.treinos.api.recordes.RecordesDaSemana.SerieDoPeriodo;
import br.com.treinos.api.recordes.RecordesPessoais;
import br.com.treinos.api.recordes.RecordesPessoais.Marca;
import br.com.treinos.api.retorno.RetornoProperties;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository.SessaoParaXp;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.PlanoTreinoVersao;
import br.com.treinos.api.treino.PlanoTreinoVersaoRepository;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Monta o XP de um aluno (plano {@code xp-e-niveis}) a cada leitura, sem gravar nada: reúne os dados já filtrados por aluno e
 * consultoria ({@code @TenantId}) e entrega à regra pura {@link RegrasXp}. Quem chama decide quem pode ver: o XP bruto só vai
 * ao próprio aluno; ao colega, só o {@code nivel}.
 * <ul>
 * <li><b>Treinos:</b> as sessões concluídas e aceitas ({@code sessoesParaXp}); reabrir ({@code concluida=false}) sai da conta.</li>
 * <li><b>Conquistas:</b> as já gravadas em {@code conquista_aluno} (só os tipos).</li>
 * <li><b>Recorde:</b> só o de carga ({@code MAIOR_CARGA}), um por exercício por dia, pela mesma regra e pelas mesmas séries simples
 * dos recordes do app, varrendo o histórico dia a dia. Com {@code TREINOS_RETORNO_HABILITADO} desligado o recorde vale zero.</li>
 * <li><b>Semana completa (decisão do servidor, difere do app):</b> para cada segunda e cada versão do plano em que houve sessão
 * concluída naquela semana, {@code total} = sessões TREINO com dia fixo da versão e {@code feitas} = quantas delas foram
 * concluídas na semana (cada sessão conta uma vez, em qualquer dia da semana). O app compara a data com o dia fixo e olha as séries,
 * e respeita o período da pasta; aqui não há data prevista nem período. Semana que mistura duas versões vale pela que a completou;
 * plano sem dia fixo nunca comemora.</li>
 * </ul>
 */
@Service
public class XpService {

    private final SessaoConcluidaRepository sessoes;
    private final ConquistaAlunoRepository conquistas;
    private final ExecucaoSerieRepository execucoes;
    private final IndicesDeVersao indices;
    private final PlanoTreinoVersaoRepository versoes;
    private final JsonMapper json;
    private final RetornoProperties retorno;

    public XpService(SessaoConcluidaRepository sessoes, ConquistaAlunoRepository conquistas, ExecucaoSerieRepository execucoes,
                     IndicesDeVersao indices, PlanoTreinoVersaoRepository versoes, JsonMapper json, RetornoProperties retorno) {
        this.sessoes = sessoes;
        this.conquistas = conquistas;
        this.execucoes = execucoes;
        this.indices = indices;
        this.versoes = versoes;
        this.json = json;
        this.retorno = retorno;
    }

    /**
     * O XP do aluno (sem checar quem pergunta). shortcut: relê todo o histórico de sessões e de séries simples do aluno a cada
     * chamada, sem janela (uma janela faria o XP cair com o tempo); trocar por total gravado ou cache se ficar lento.
     */
    @Transactional(readOnly = true)
    public Xp doAluno(UUID alunoId) {
        List<SessaoParaXp> concluidas = sessoes.sessoesParaXp(alunoId);
        List<SessaoDoDia> treinos = concluidas.stream().map(s -> new SessaoDoDia(s.data(), true, s.resultado())).toList();
        Set<String> tipos = conquistas.findByAlunoIdOrderByConquistadaEmDesc(alunoId).stream().map(ConquistaAluno::getTipo)
                .collect(Collectors.toSet());
        return RegrasXp.calcular(treinos, semanas(concluidas), tipos, recordes(alunoId));
    }

    private List<SemanaDoPlano> semanas(List<SessaoParaXp> concluidas) {
        Map<LocalDate, Map<UUID, Set<UUID>>> feitasPorSemana = new HashMap<>();
        for (SessaoParaXp s : concluidas) {
            LocalDate segunda = s.data().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            feitasPorSemana.computeIfAbsent(segunda, k -> new HashMap<>()).computeIfAbsent(s.planoVersaoId(), k -> new HashSet<>())
                    .add(s.sessaoUid());
        }
        Map<UUID, Set<UUID>> previstos = treinosComDiaFixo(concluidas.stream().map(SessaoParaXp::planoVersaoId).collect(Collectors.toSet()));
        List<SemanaDoPlano> semanas = new ArrayList<>();
        feitasPorSemana.forEach((segunda, porVersao) -> porVersao.forEach((versaoId, feitas) -> {
            Set<UUID> daVersao = previstos.getOrDefault(versaoId, Set.of());
            semanas.add(new SemanaDoPlano(segunda, (int) feitas.stream().filter(daVersao::contains).count(), daVersao.size()));
        }));
        return semanas;
    }

    /** Por versão, os uids das sessões do tipo TREINO que têm dia fixo (as que o plano prevê toda semana). */
    private Map<UUID, Set<UUID>> treinosComDiaFixo(Collection<UUID> versaoIds) {
        Map<UUID, Set<UUID>> mapa = new HashMap<>();
        if (versaoIds.isEmpty()) {
            return mapa;
        }
        for (PlanoTreinoVersao v : versoes.findByIdIn(versaoIds)) {
            mapa.put(v.getId(), json.readValue(v.getConteudo(), ConteudoTreino.class).sessoesOuVazio().stream()
                    .filter(s -> s.uid() != null && s.diaSemana() != null && ConteudoTreino.TREINO.equals(s.tipo()))
                    .map(ConteudoTreino.Sessao::uid).collect(Collectors.toSet()));
        }
        return mapa;
    }

    /** Os exercícios que bateram recorde de carga em cada dia, hoje inclusive; o primeiro dia de um exercício nunca conta. */
    private List<RecordeDoDia> recordes(UUID alunoId) {
        if (!retorno.habilitado()) {
            return List.of();
        }
        List<UUID> exercicios = execucoes.exerciciosComSerieFeita(alunoId);
        if (exercicios.isEmpty()) {
            return List.of();
        }
        List<ExecucaoSerie> series = execucoes
                .findByAlunoIdAndExercicioIdInAndConcluidaTrueAndCargaNotNullAndRepeticoesNotNullAndEtapasIsNullAndDataBefore(
                        alunoId, exercicios, LocalDate.now(Fuso.BRASILIA).plusDays(1));
        Map<UUID, IndiceVersao> porVersao = indices.carregar(series.stream().map(ExecucaoSerie::getPlanoVersaoId).distinct().toList());
        Map<UUID, List<SerieDoPeriodo<UUID>>> porExercicio = new HashMap<>();
        for (ExecucaoSerie e : series) {
            IndiceVersao indice = porVersao.get(e.getPlanoVersaoId());
            // Estrito, como o perfil do colega: série que a versão não confirma simples não entra nem na base.
            Marca marca = IndiceVersao.simples(indice, e.getSerieUid(), false) && RecordesPessoais.conta(e.getCarga(), e.getRepeticoes())
                    ? new Marca(e.getCarga(), e.getRepeticoes()) : null;
            int ordem = indice == null ? 0 : indice.serie(e.getSerieUid()).map(LocalSerie::ordem).orElse(0);
            porExercicio.computeIfAbsent(e.getExercicioId(), k -> new ArrayList<>())
                    .add(new SerieDoPeriodo<>(e.getData(), ordem, marca, e.getExercicioId()));
        }
        List<RecordeDoDia> recordes = new ArrayList<>();
        porExercicio.forEach((exercicioId, lista) -> RecordesDaSemana.doPeriodo(null, lista).stream()
                .filter(r -> r.recordes().stream().anyMatch(x -> x.tipo() == RecordesPessoais.Tipo.MAIOR_CARGA))
                .forEach(r -> recordes.add(new RecordeDoDia(r.data(), exercicioId.toString()))));
        return recordes;
    }
}
