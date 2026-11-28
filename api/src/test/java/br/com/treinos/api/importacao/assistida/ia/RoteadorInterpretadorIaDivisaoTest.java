package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.importacao.assistida.BlocoTexto;
import br.com.treinos.api.treino.ConteudoTreino;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Documento grande lido em partes, nova tentativa com retry-after e a linha de log de uso. Só valores fictícios. */
class RoteadorInterpretadorIaDivisaoTest {

    private final InterpretadorGemini gemini = mock(InterpretadorGemini.class);
    private final InterpretadorClaude claude = mock(InterpretadorClaude.class);
    private final InterpretadorPorRegras regras = new InterpretadorPorRegras();

    private RoteadorInterpretadorIa roteador() {
        ConfiguracaoIaImportacao c = new ConfiguracaoIaImportacao();
        c.setProvedor("claude");
        c.setClaudeApiKey("chave-ficticia-claude");
        c.setEnviarDadosAoProvedor(true);
        RoteadorInterpretadorIa r = new RoteadorInterpretadorIa(c, gemini, claude, regras);
        r.espera = Duration.ZERO;
        return r;
    }

    /** Páginas com a marca do extrator do PDF, cada uma com cerca de {@code tamanho} caracteres. */
    private static ContextoIa pdf(int paginas, int tamanho) {
        List<BlocoTexto> blocos = new ArrayList<>();
        StringBuilder texto = new StringBuilder();
        for (int p = 1; p <= paginas; p++) {
            String conteudo = "Treino da pagina " + p + "\nSupino reto 3x10\n" + "x".repeat(tamanho);
            blocos.add(new BlocoTexto("Página " + p, conteudo, "arquivo-ficticio.pdf", p));
            texto.append(texto.isEmpty() ? "" : "\n\n").append("=== PÁGINA ").append(p).append(" ===\n").append(conteudo);
        }
        return new ContextoIa("arquivo-ficticio.pdf", "PDF", blocos, texto.toString(), List.of(), Map.of());
    }

    private static ResultadoInterpretacao.PropostaGrupo grupo(String nome, String sessao) {
        ConteudoTreino treino = new ConteudoTreino(null, null, List.of(new ConteudoTreino.Sessao(UUID.randomUUID(), sessao,
                null, null, null, null, null, List.of(new ConteudoTreino.ExercicioPlano(UUID.randomUUID(), null,
                        "Supino reto", null, null, null, true, "kg", List.of())))));
        return new ResultadoInterpretacao.PropostaGrupo("arquivo-ficticio.pdf", nome, null, null, null, null, List.of(),
                treino, null);
    }

    private static ResultadoInterpretacao resultado(ResultadoInterpretacao.PropostaGrupo g, long saida) {
        return new ResultadoInterpretacao(List.of(g), List.of(),
                new ResultadoInterpretacao.Uso("claude-haiku-5-5", "end_turn", 1000, saida, 800, 0));
    }

    @Test
    void dividePorPaginaInteiraSemPerderNada() {
        String texto = pdf(6, 1000).textoParaProvedor();

        List<String> partes = RoteadorInterpretadorIa.dividir(texto, 2500);

        assertThat(partes).hasSize(3).allSatisfy(p -> assertThat(p).startsWith("=== PÁGINA ").hasSizeLessThanOrEqualTo(2500));
        assertThat(String.join("", partes)).isEqualTo(texto);
    }

    @Test
    void abaGrandeEhCortadaPorLinhaRepetindoAMarcaEAsColunas() {
        String cabecalho = "=== ABA: Alunos ===\nColunas: Nome | Peso\n";
        String linhas = IntStream.range(0, 400).mapToObj(i -> "Aluno Ficticio " + i + " | 80\n").reduce("", String::concat);

        List<String> partes = RoteadorInterpretadorIa.dividir(cabecalho + linhas, 2000);

        assertThat(partes).hasSizeGreaterThan(2).allSatisfy(p -> assertThat(p).startsWith(cabecalho));
        String dados = String.join("", partes).replace(cabecalho, "");
        assertThat(dados).isEqualTo(linhas);
    }

    @Test
    void limiteDaParteFicaEntreMetadeESessentaMilENuncaPassaDeOitoPartes() {
        assertThat(RoteadorInterpretadorIa.limiteDaParte(100_000)).isEqualTo(55_001);
        assertThat(RoteadorInterpretadorIa.limiteDaParte(300_000)).isEqualTo(60_000);
        assertThat(RoteadorInterpretadorIa.limiteDaParte(500_000)).isEqualTo(62_500);
    }

    @Test
    void respostaCortadaDivideEJuntaOMesmoAlunoPeloNomeSemAcento() {
        ContextoIa c = pdf(2, 1000);
        when(claude.interpretar(any())).thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));
        when(claude.interpretarTrecho(any(), argThat(t -> t != null && t.contains("PÁGINA 1 "))))
                .thenReturn(resultado(grupo("José da Silva Ficticio", "Treino A"), 100));
        when(claude.interpretarTrecho(any(), argThat(t -> t != null && t.contains("PÁGINA 2 "))))
                .thenReturn(resultado(grupo("JOSE DA SILVA  FICTICIO", "Treino B"), 200));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador().interpretarComModo(c);

        assertThat(exec.modoEfetivo()).isEqualTo("IA");
        assertThat(exec.fallbackParaRegras()).isFalse();
        assertThat(exec.motivoFallback()).isNull();
        assertThat(exec.resultado().grupos()).singleElement().satisfies(g -> {
            assertThat(g.nomeAluno()).isEqualTo("José da Silva Ficticio");
            assertThat(g.treino().sessoes()).extracting(ConteudoTreino.Sessao::nome).containsExactly("Treino A", "Treino B");
            assertThat(g.avisos()).contains("Documento grande: lido em 2 partes.");
        });
        verify(claude, times(2)).interpretarTrecho(any(), anyString());
    }

    @Test
    void textoMuitoGrandeJaVaiEmPartesSemTentarInteiro() {
        ContextoIa c = pdf(30, 9_000);
        assertThat(c.textoParaProvedor().length()).isGreaterThan(RoteadorInterpretadorIa.CARACTERES_PARA_DIVIDIR_NA_IDA);
        when(claude.interpretarTrecho(any(), anyString())).thenReturn(resultado(grupo("Fulano Ficticio", "Treino A"), 10));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador().interpretarComModo(c);

        verify(claude, never()).interpretar(any());
        assertThat(exec.modoEfetivo()).isEqualTo("IA");
        assertThat(exec.resultado().grupos()).singleElement()
                .satisfies(g -> assertThat(g.avisos()).anyMatch(a -> a.startsWith("Documento grande: lido em ")));
    }

    @Test
    void parteQueAindaCortaVaiAsRegrasSoComOsBlocosDela() {
        ContextoIa c = pdf(2, 1000);
        when(claude.interpretar(any())).thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));
        when(claude.interpretarTrecho(any(), argThat(t -> t != null && t.contains("PÁGINA 1 "))))
                .thenReturn(resultado(grupo("Fulano Ficticio", "Treino A"), 100));
        when(claude.interpretarTrecho(any(), argThat(t -> t != null && t.contains("PÁGINA 2 "))))
                .thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador().interpretarComModo(c);

        assertThat(exec.modoEfetivo()).isEqualTo("IA");
        assertThat(exec.fallbackParaRegras()).isTrue();
        assertThat(exec.motivoFallback()).isEqualTo("RESPOSTA_CORTADA");
        // O grupo da IA e o das regras (página 2 sozinha), com nomes diferentes: não se juntam.
        assertThat(exec.resultado().grupos()).hasSize(2);
        assertThat(exec.resultado().grupos().getFirst().nomeAluno()).isEqualTo("Fulano Ficticio");
    }

    @Test
    void nenhumaParteLidaPelaIaVoltaAoArquivoInteiroPelasRegras() {
        ContextoIa c = pdf(2, 1000);
        when(claude.interpretar(any())).thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));
        when(claude.interpretarTrecho(any(), anyString())).thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador().interpretarComModo(c);

        assertThat(exec.modoEfetivo()).isEqualTo("REGRAS");
        assertThat(exec.fallbackParaRegras()).isTrue();
        assertThat(exec.motivoFallback()).isEqualTo("RESPOSTA_CORTADA");
    }

    @Test
    void novaTentativaEsperaORetryAfterPedido() {
        when(claude.interpretar(any())).thenThrow(new FalhaPassageiraDoProvedor("429", Duration.ofMillis(5)))
                .thenReturn(resultado(grupo("Fulano Ficticio", "Treino A"), 10));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador().interpretarComModo(pdf(1, 10));

        verify(claude, times(2)).interpretar(any());
        assertThat(exec.modoEfetivo()).isEqualTo("IA");
    }

    @Test
    void provedorLentoEstouraOOrcamentoEOArquivoTerminaComAsPartesLidasEORestoNasRegrasComAviso() {
        ContextoIa c = pdf(3, 1000);
        when(claude.interpretar(any())).thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));
        when(claude.interpretarTrecho(any(), argThat(t -> t != null && t.contains("PÁGINA 1 "))))
                .thenReturn(resultado(grupo("Fulano Ficticio", "Treino A"), 100));
        when(claude.interpretarTrecho(any(), argThat(t -> t != null && t.contains("PÁGINA 2 ")))).thenAnswer(inv -> {
            Thread.sleep(5_000); // interrompida quando o orçamento acaba
            return resultado(grupo("Fulano Ficticio", "Treino B"), 100);
        });
        RoteadorInterpretadorIa r = roteador();
        r.orcamento = Duration.ofMillis(400);
        r.minimoParaUmaChamada = Duration.ZERO;
        long inicio = System.nanoTime();

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = r.interpretarComModo(c);

        assertThat(Duration.ofNanos(System.nanoTime() - inicio)).isLessThan(Duration.ofSeconds(3));
        assertThat(exec.modoEfetivo()).isEqualTo("IA");
        assertThat(exec.fallbackParaRegras()).isTrue();
        assertThat(exec.motivoFallback()).isEqualTo("TEMPO_ESGOTADO");
        // A página 1 pela IA; a 2 (cortada) e a 3 (sem tempo, nem chamada) pelas regras, cada uma no seu grupo.
        assertThat(exec.resultado().grupos()).hasSize(3)
                .allSatisfy(g -> assertThat(g.avisos()).contains(RoteadorInterpretadorIa.AVISO_TEMPO_ESGOTADO));
        assertThat(exec.resultado().grupos().getFirst().treino().sessoes()).extracting(ConteudoTreino.Sessao::nome)
                .containsExactly("Treino A");
        verify(claude, never()).interpretarTrecho(any(), argThat(t -> t != null && t.contains("PÁGINA 3 ")));
    }

    @Test
    void semTempoNemParaAChamadaInteiraOArquivoVaiAsRegrasComAviso() {
        RoteadorInterpretadorIa r = roteador();
        r.orcamento = Duration.ofSeconds(10);
        r.minimoParaUmaChamada = Duration.ofSeconds(20);

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = r.interpretarComModo(pdf(1, 10));

        verify(claude, never()).interpretar(any());
        assertThat(exec.modoEfetivo()).isEqualTo("REGRAS");
        assertThat(exec.motivoFallback()).isEqualTo("TEMPO_ESGOTADO");
        assertThat(exec.resultado().grupos())
                .allSatisfy(g -> assertThat(g.avisos()).contains(RoteadorInterpretadorIa.AVISO_TEMPO_ESGOTADO));
    }

    @Test
    void novaTentativaSoSaiSeAindaCouberNoOrcamento() {
        when(claude.interpretar(any())).thenThrow(new FalhaPassageiraDoProvedor("429", Duration.ofSeconds(20)));
        RoteadorInterpretadorIa r = roteador();
        r.orcamento = Duration.ofSeconds(30);
        r.minimoParaUmaChamada = Duration.ofSeconds(15);

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = r.interpretarComModo(pdf(1, 10));

        verify(claude, times(1)).interpretar(any());
        assertThat(exec.motivoFallback()).isEqualTo("ERRO_PROVEDOR");
    }

    @Test
    void partesSemNomeLidoNaoSeJuntamMesmoDoMesmoArquivo() {
        ContextoIa c = pdf(2, 1000);
        var semNome = new ResultadoInterpretacao.PropostaGrupo("arquivo-ficticio.pdf", null, null, null, null, null,
                List.of(), null, null, List.of(), ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO);
        when(claude.interpretar(any())).thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));
        when(claude.interpretarTrecho(any(), anyString()))
                .thenReturn(new ResultadoInterpretacao(List.of(semNome), List.of()));

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador().interpretarComModo(c);

        assertThat(exec.resultado().grupos()).hasSize(2).allSatisfy(g ->
                assertThat(g.origemDoNome()).isEqualTo(ResultadoInterpretacao.OrigemDoNome.NOME_DO_ARQUIVO));
    }

    @Test
    void abaFatiadaQueCaiNasRegrasSoLeOPedacoDaParteSemRelerOQueAIaLeu() {
        String linhas = IntStream.range(0, 400).mapToObj(i -> "Aluno Ficticio " + i + " | 80\n").reduce("", String::concat);
        String aba = "=== ABA: Alunos ===\nColunas: Nome | Peso\n" + linhas;
        ContextoIa c = new ContextoIa("planilha-ficticia.xlsx", "XLSX",
                List.of(new BlocoTexto("Alunos", aba, "planilha-ficticia.xlsx", 1)), aba, List.of(), Map.of());
        InterpretadorPorRegras regrasVigiadas = org.mockito.Mockito.spy(new InterpretadorPorRegras());
        when(claude.interpretar(any())).thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));
        when(claude.interpretarTrecho(any(), argThat(t -> t != null && t.contains("Aluno Ficticio 0 |"))))
                .thenReturn(resultado(grupo("Fulano Ficticio", "Treino A"), 100));
        when(claude.interpretarTrecho(any(), argThat(t -> t != null && !t.contains("Aluno Ficticio 0 |"))))
                .thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));
        ConfiguracaoIaImportacao conf = new ConfiguracaoIaImportacao();
        conf.setProvedor("claude");
        conf.setClaudeApiKey("chave-ficticia-claude");
        conf.setEnviarDadosAoProvedor(true);

        new RoteadorInterpretadorIa(conf, gemini, claude, regrasVigiadas).interpretarComModo(c);

        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<List<BlocoTexto>> blocos = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(regrasVigiadas).interpretar(any(), blocos.capture());
        String lido = blocos.getValue().stream().map(BlocoTexto::conteudo).reduce("", String::concat);
        assertThat(lido).startsWith("=== ABA: Alunos ===").contains("Aluno Ficticio 399 |")
                .doesNotContain("Aluno Ficticio 0 |");
    }

    @Test
    void umaLinhaDeLogPorArquivoSemConteudoNemNomes() {
        Logger logger = (Logger) LoggerFactory.getLogger(RoteadorInterpretadorIa.class);
        ListAppender<ILoggingEvent> linhas = new ListAppender<>();
        linhas.start();
        logger.addAppender(linhas);
        try {
            when(claude.interpretar(any())).thenReturn(resultado(grupo("Sentinela Zzyx Ficticio", "Treino A"), 340));
            UUID sessao = UUID.randomUUID();

            roteador().interpretarComModo(pdf(1, 10), sessao);

            assertThat(linhas.list).singleElement().satisfies(e -> assertThat(e.getFormattedMessage())
                    .contains("sessao=" + sessao, "provedor=claude", "modelo=claude-haiku-5-5", "paradas=end_turn",
                            "tokensEntrada=1000", "tokensSaida=340", "cacheLido=800", "modo=IA", "tentativas=1", "partes=1")
                    .doesNotContain("Sentinela", "arquivo-ficticio", "Supino", "pagina"));
        } finally {
            logger.detachAppender(linhas);
        }
    }
}
