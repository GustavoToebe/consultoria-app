package br.com.treinos.api.comunidade;

import br.com.treinos.api.comunidade.RegrasXp.Xp;
import br.com.treinos.api.execucao.ExecucaoSerie;
import br.com.treinos.api.execucao.ExecucaoSerieRepository;
import br.com.treinos.api.execucao.IndiceVersao;
import br.com.treinos.api.execucao.IndiceVersao.LocalSerie;
import br.com.treinos.api.execucao.IndicesDeVersao;
import br.com.treinos.api.retorno.RetornoProperties;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository.SessaoParaXp;
import br.com.treinos.api.treino.PlanoTreinoVersao;
import br.com.treinos.api.treino.PlanoTreinoVersaoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Montagem do XP com repositórios de mentira (a regra em si está no {@code RegrasXpTest}). Só dados fictícios. */
@ExtendWith(MockitoExtension.class)
class XpServiceTest {

    // 09/11/2026 é segunda-feira.
    private static final LocalDate SEGUNDA = LocalDate.of(2026, 11, 9);
    private static final LocalDate QUARTA = SEGUNDA.plusDays(2);
    private static final LocalDate SEGUNDA_SEGUINTE = SEGUNDA.plusDays(7);

    @Mock private SessaoConcluidaRepository sessoes;
    @Mock private ConquistaAlunoRepository conquistas;
    @Mock private ExecucaoSerieRepository execucoes;
    @Mock private IndicesDeVersao indices;
    @Mock private PlanoTreinoVersaoRepository versoes;

    private final JsonMapper json = JsonMapper.builder().build();
    private final UUID alunoId = UUID.randomUUID();
    private final UUID versaoId = UUID.randomUUID();
    private final UUID treinoA = UUID.randomUUID();
    private final UUID treinoB = UUID.randomUUID();

    private XpService servico(boolean retornoLigado) {
        return new XpService(sessoes, conquistas, execucoes, indices, versoes, json, new RetornoProperties(retornoLigado));
    }

    private SessaoParaXp sessao(LocalDate data, String resultado, UUID sessaoUid) {
        return new SessaoParaXp(data, resultado, versaoId, sessaoUid);
    }

    /** Versão do plano com dois treinos de dia fixo (segunda e quarta) e um descanso com dia (que não é treino). */
    private void planoComDiaFixo() {
        PlanoTreinoVersao v = mock(PlanoTreinoVersao.class);
        when(v.getId()).thenReturn(versaoId);
        when(v.getConteudo()).thenReturn("{\"sessoes\":["
                + "{\"uid\":\"" + treinoA + "\",\"nome\":\"A\",\"diaSemana\":1,\"tipo\":\"TREINO\"},"
                + "{\"uid\":\"" + treinoB + "\",\"nome\":\"B\",\"diaSemana\":3,\"tipo\":\"TREINO\"},"
                + "{\"uid\":\"" + UUID.randomUUID() + "\",\"nome\":\"Folga\",\"diaSemana\":2,\"tipo\":\"DESCANSO\"}]}");
        when(versoes.findByIdIn(anyCollection())).thenReturn(List.of(v));
    }

    @Test
    void doisTreinosNoMesmoDiaContamUmSoEConquistaEntra() {
        when(sessoes.sessoesParaXp(alunoId)).thenReturn(List.of(sessao(SEGUNDA, "COMPLETA", treinoA),
                sessao(SEGUNDA, "PARCIAL", treinoB), sessao(QUARTA, "PARCIAL", treinoB)));
        when(conquistas.findByAlunoIdOrderByConquistadaEmDesc(alunoId))
                .thenReturn(List.of(new ConquistaAluno(alunoId, "PRIMEIRO_TREINO", "t", "d", "i")));
        when(versoes.findByIdIn(anyCollection())).thenReturn(List.of());

        Xp xp = servico(false).doAluno(alunoId);

        // 10 (melhor da segunda) + 5 (quarta) + 50 (conquista); versão sem dia fixo conhecido não comemora semana.
        assertThat(xp).isEqualTo(new Xp(65, 1, 65, 35));
    }

    @Test
    void semanaCompletaSoComTodosOsTreinosComDiaFixoDaVersaoEPlanoSemDiaFixoNaoComemora() {
        planoComDiaFixo();
        // Semana 1: os dois treinos previstos (a quarta pode ser feita em outro dia, o que conta é a sessão). Semana 2: só um.
        when(sessoes.sessoesParaXp(alunoId)).thenReturn(List.of(sessao(SEGUNDA, "COMPLETA", treinoA),
                sessao(QUARTA, "COMPLETA", treinoB), sessao(SEGUNDA_SEGUINTE, "COMPLETA", treinoA)));
        when(conquistas.findByAlunoIdOrderByConquistadaEmDesc(alunoId)).thenReturn(List.of());

        Xp xp = servico(false).doAluno(alunoId);

        assertThat(xp.xp()).isEqualTo(10 + 10 + 10 + 20);
    }

    @Test
    void planoSemDiaFixoNuncaComemora() {
        PlanoTreinoVersao v = mock(PlanoTreinoVersao.class);
        when(v.getId()).thenReturn(versaoId);
        when(v.getConteudo()).thenReturn("{\"sessoes\":[{\"uid\":\"" + treinoA + "\",\"nome\":\"A\",\"tipo\":\"TREINO\"}]}");
        when(versoes.findByIdIn(anyCollection())).thenReturn(List.of(v));
        when(sessoes.sessoesParaXp(alunoId)).thenReturn(List.of(sessao(SEGUNDA, "COMPLETA", treinoA)));
        when(conquistas.findByAlunoIdOrderByConquistadaEmDesc(alunoId)).thenReturn(List.of());

        assertThat(servico(false).doAluno(alunoId).xp()).isEqualTo(10);
    }

    @Test
    void alunoSemNadaTemXpZeroNoNivelUm() {
        when(sessoes.sessoesParaXp(alunoId)).thenReturn(List.of());
        when(conquistas.findByAlunoIdOrderByConquistadaEmDesc(alunoId)).thenReturn(List.of());

        assertThat(servico(true).doAluno(alunoId)).isEqualTo(new Xp(0, 1, 0, 100));
    }

    private ExecucaoSerie serie(UUID exercicioId, LocalDate data, String carga, int repeticoes, UUID serieUid) {
        ExecucaoSerie e = mock(ExecucaoSerie.class);
        when(e.getExercicioId()).thenReturn(exercicioId);
        when(e.getPlanoVersaoId()).thenReturn(versaoId);
        when(e.getSerieUid()).thenReturn(serieUid);
        when(e.getData()).thenReturn(data);
        when(e.getCarga()).thenReturn(new BigDecimal(carga));
        when(e.getRepeticoes()).thenReturn(repeticoes);
        return e;
    }

    @Test
    void soORecordeDeCargaContaEPrimeiroDiaNaoContaEChaveDesligadaZeraORecorde() {
        UUID exercicio = UUID.randomUUID();
        UUID serieUid = UUID.randomUUID();
        when(sessoes.sessoesParaXp(alunoId)).thenReturn(List.of());
        when(conquistas.findByAlunoIdOrderByConquistadaEmDesc(alunoId)).thenReturn(List.of());

        // Chave desligada: nem consulta as séries.
        assertThat(servico(false).doAluno(alunoId).xp()).isZero();
        verifyNoInteractions(execucoes);

        IndiceVersao indice = mock(IndiceVersao.class);
        when(indice.serie(serieUid)).thenReturn(Optional.of(new LocalSerie(UUID.randomUUID(), UUID.randomUUID(), exercicio, true, "kg",
                "Trabalho", 0, true, null, true, "WORKING", 1)));
        when(indices.carregar(anyCollection())).thenReturn(Map.of(versaoId, indice));
        when(execucoes.exerciciosComSerieFeita(alunoId)).thenReturn(List.of(exercicio));
        // Montada antes do when(): criar o mock da série stuba dentro de outro stub e o Mockito recusa.
        List<ExecucaoSerie> lista = List.of(
                serie(exercicio, SEGUNDA, "100", 5, serieUid),                     // primeiro dia: não conta
                serie(exercicio, QUARTA, "110", 5, serieUid),                      // carga maior: +15
                serie(exercicio, QUARTA, "100", 12, serieUid),                     // mesmo dia: continua um só
                serie(exercicio, SEGUNDA_SEGUINTE, "110", 8, serieUid));           // só mais repetições: não é de carga
        when(execucoes.findByAlunoIdAndExercicioIdInAndConcluidaTrueAndCargaNotNullAndRepeticoesNotNullAndEtapasIsNullAndDataBefore(
                eq(alunoId), anyCollection(), any(LocalDate.class))).thenReturn(lista);

        assertThat(servico(true).doAluno(alunoId).xp()).isEqualTo(RegrasXp.XP_RECORDE);
    }
}
