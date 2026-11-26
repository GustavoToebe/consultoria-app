package br.com.treinos.api.importacao.assistida.ia;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.importacao.assistida.BlocoTexto;
import br.com.treinos.api.treino.ConteudoTreino;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** LGPD fail-closed: nada do arquivo vai a um provedor sem a propriedade explícita. Só valores fictícios. */
class RoteadorInterpretadorIaTest {

    private static final String SENTINELA = "Sentinela Zzyx Fulano";

    private final InterpretadorGemini gemini = mock(InterpretadorGemini.class);
    private final InterpretadorClaude claude = mock(InterpretadorClaude.class);
    private final InterpretadorPorRegras regras = new InterpretadorPorRegras();

    private static ContextoIa contexto() {
        String texto = "Aluno: " + SENTINELA + "\nPeso: 80 kg\n";
        return new ContextoIa("arquivo-secreto.pdf", "PDF", List.of(new BlocoTexto("Geral", texto, "arquivo-secreto.pdf", 1)),
                "Aluno: [NOME]\n", "CADASTROS_E_PLANOS_ATUAIS", List.of(), Map.of());
    }

    private ConfiguracaoIaImportacao config(String provedor, boolean enviar) {
        ConfiguracaoIaImportacao c = new ConfiguracaoIaImportacao();
        c.setProvedor(provedor);
        c.setGeminiApiKey("chave-ficticia-gemini");
        c.setClaudeApiKey("chave-ficticia-claude");
        c.setEnviarDadosAoProvedor(enviar);
        return c;
    }

    @Test
    void padraoNaoEnviaNada() {
        assertThat(new ConfiguracaoIaImportacao().isEnviarDadosAoProvedor()).isFalse();
    }

    @Test
    void semAPropriedadeOProvedorConfiguradoNuncaEChamadoEOValorSentinelaNaoSai() {
        for (String provedor : List.of("gemini", "claude")) {
            RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config(provedor, false), gemini, claude, regras);

            RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador.interpretarComModo(contexto());

            // Resultado local (regras): o nome saiu do bloco original, que só existe no servidor.
            assertThat(exec.modoEfetivo()).isEqualTo("REGRAS");
            assertThat(exec.fallbackParaRegras()).isFalse();
            assertThat(exec.motivoFallback()).isEqualTo("ENVIO_DESLIGADO");
            assertThat(exec.resultado().grupos().getFirst().nomeAluno().toLowerCase(java.util.Locale.ROOT))
                    .contains("sentinela zzyx");
        }
        verifyNoInteractions(gemini, claude);
    }

    @Test
    void comAPropriedadeLigadaOConectorRecebeOContextoMasFalhaVoltaParaRegras() {
        when(gemini.interpretar(any())).thenThrow(new IllegalStateException("falha fixa"));
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config("gemini", true), gemini, claude, regras);

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador.interpretarComModo(contexto());

        verify(gemini).interpretar(any());
        assertThat(exec.modoEfetivo()).isEqualTo("REGRAS");
        assertThat(exec.provedorConfigurado()).isEqualTo("gemini");
        assertThat(exec.fallbackParaRegras()).isTrue();
        assertThat(exec.motivoFallback()).isEqualTo("ERRO_PROVEDOR");
        assertThat(exec.resultado().grupos()).hasSize(1);
    }

    @Test
    void comAPropriedadeLigadaEProvedorComSucessoRetornaModoIa() {
        when(gemini.interpretar(any())).thenReturn(new ResultadoInterpretacao(List.of(), List.of()));
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config("gemini", true), gemini, claude, regras);

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador.interpretarComModo(contexto());

        assertThat(exec.modoEfetivo()).isEqualTo("IA");
        assertThat(exec.provedorConfigurado()).isEqualTo("gemini");
        assertThat(exec.fallbackParaRegras()).isFalse();
        assertThat(exec.motivoFallback()).isNull();
    }

    @Test
    void conectorSoEnviaOTextoDoContextoEExigeTexto() {
        ContextoIa c = contexto();
        assertThat(DecodificadorDaProposta.textoParaEnvio(c)).isEqualTo("Aluno: [NOME]\n").doesNotContain("Sentinela");

        ContextoIa semTexto = new ContextoIa("a.pdf", "PDF", List.of(), " ", null, List.of(), Map.of());
        assertThatThrownBy(() -> DecodificadorDaProposta.textoParaEnvio(semTexto)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void formatoSimplesDaIaViraTreinoEDietaSemInventarEIgnoraAsDuvidasDela() {
        JsonMapper json = JsonMapper.builder().build();
        JsonNode raiz = json.readTree("""
                {"grupos": [
                  {"nomeAluno": "Fulano Teste", "pesos": [{"data": "2026-11-20", "kg": 80.5}, {"kg": 79}],
                   "treino": {"sessoes": [
                     {"nome": "Treino A", "diaSemana": 9, "exercicios": [
                       {"nome": "Supino reto", "observacao": "Rest pause na ultima",
                        "series": [{"quantidade": 3, "tipo": "WS", "repsMin": 6, "repsMax": 10, "descansoSegundos": 120},
                                   {"quantidade": 1, "repsMin": 12}]},
                       {"nome": "  ", "series": [{"quantidade": 2}]}]},
                     {"nome": "Treino B", "exercicios": []}]},
                   "dieta": {"refeicoes": [
                     {"nome": "Cafe", "horario": "7h", "itens": [{"nome": "Ovo", "quantidade": 2, "unidade": "un"}]},
                     {"nome": "Almoco", "horario": "12:30", "opcoes": [
                       {"itens": [{"nome": "Arroz", "quantidade": "150", "unidade": "g"}]},
                       {"itens": [{"nome": "Batata"}, {"nome": "Azeite", "unidade": "colheres"}, {"nome": "Feijao", "unidade": "gramas"}]}]}]}},
                  {"aluno": "formato desconhecido", "sessao": "Treino C"}],
                 "duvidas": [{"tipo": "EXERCICIO_NAO_RECONHECIDO", "termoOriginal": ""}]}""");

        ResultadoInterpretacao r = DecodificadorDaProposta.decodificar(json, raiz, contexto());

        assertThat(r.duvidas()).isEmpty();
        ResultadoInterpretacao.PropostaGrupo g = r.grupos().getFirst();
        assertThat(r.grupos()).hasSize(1);
        assertThat(g.nomeAluno()).isEqualTo("Fulano Teste");
        assertThat(g.pesos()).singleElement().satisfies(p -> assertThat(p.kg()).isEqualByComparingTo("80.5"));

        // Sessão sem exercício e exercício sem nome saem; dia fora de 1 a 7 vira nulo.
        assertThat(g.treino().sessoes()).singleElement().satisfies(s -> {
            assertThat(s.nome()).isEqualTo("Treino A");
            assertThat(s.diaSemana()).isNull();
            assertThat(s.exercicios()).singleElement().satisfies(e -> {
                assertThat(e.observacao()).isEqualTo("Rest pause na ultima");
                assertThat(e.series()).hasSize(4);
                assertThat(e.series().getFirst()).satisfies(sr -> {
                    assertThat(sr.tipo()).isEqualTo("WS");
                    assertThat(sr.repsMin()).isEqualTo(6);
                    assertThat(sr.repsMax()).isEqualTo(10);
                    assertThat(sr.descansoSegundos()).isEqualTo(120);
                    assertThat(sr.carga()).isNull();
                });
                // Só o mínimo escrito: vale como repetições exatas; sem tipo nem descanso, nada é inventado.
                assertThat(e.series().getLast()).satisfies(sr -> {
                    assertThat(sr.repsMin()).isEqualTo(12);
                    assertThat(sr.repsMax()).isEqualTo(12);
                    assertThat(sr.tipo()).isNull();
                    assertThat(sr.descansoSegundos()).isNull();
                });
            });
        });

        assertThat(g.dieta().refeicoes()).hasSize(2);
        assertThat(g.dieta().refeicoes().getFirst()).satisfies(ref -> {
            assertThat(ref.horario()).isNull();
            assertThat(ref.opcoes().getFirst().itens().getFirst().quantidade()).isEqualByComparingTo("2");
        });
        assertThat(g.dieta().refeicoes().getLast()).satisfies(ref -> {
            assertThat(ref.horario()).isEqualTo("12:30");
            assertThat(ref.opcoes()).extracting(ConteudoDieta.Opcao::rotulo).containsExactly("A", "B");
            assertThat(ref.opcoes().getLast().itens().getFirst().quantidade()).isNull();
            assertThat(ref.opcoes().getLast().itens()).extracting(ConteudoDieta.Item::unidade)
                    .containsExactly(null, null, "g");
        });
    }

    @Test
    void resultadoDaIaGanhaAsDuvidasCalculadasContraABibliotecaComAsOcorrencias() {
        UUID uid = UUID.randomUUID();
        ConteudoTreino treino = new ConteudoTreino(null, null, List.of(new ConteudoTreino.Sessao(UUID.randomUUID(),
                "Treino A", null, null, null, null, null, List.of(new ConteudoTreino.ExercicioPlano(uid, null, "Rem",
                        null, null, null, true, "kg", List.of())))));
        when(gemini.interpretar(any())).thenReturn(new ResultadoInterpretacao(List.of(new ResultadoInterpretacao.PropostaGrupo(
                "a.pdf", "Fulano", null, null, null, null, List.of(), treino, null)), List.of()));
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config("gemini", true), gemini, claude, regras);

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador.interpretarComModo(contexto());

        assertThat(exec.modoEfetivo()).isEqualTo("IA");
        assertThat(exec.resultado().duvidas()).singleElement().satisfies(d -> {
            assertThat(d.termoOriginal()).isEqualTo("Rem");
            assertThat(d.trechoOriginal()).contains("Treino A");
            assertThat(d.ocorrenciaIds()).containsExactly(uid.toString());
        });
    }

    @Test
    void suplementoEMedicacaoSaoDecodificadosComLimitesEItemSemNomeSai() {
        JsonMapper json = JsonMapper.builder().build();
        String longo = "x".repeat(700);
        JsonNode raiz = json.readTree("""
                {"grupos": [{"nomeAluno": "Fulano Teste", "dieta": {
                  "refeicoes": [],
                  "suplementos": [{"nome": "Creatina", "dose": "5 g", "horario": "pos treino", "observacao": "%s"},
                                  {"nome": " ", "dose": "10 g"}, {"dose": "sem nome"}],
                  "medicacoes": [{"nome": "Testosterona enantato", "principioAtivo": "testosterona",
                                  "concentracao": "250 mg/ml", "dose": "250 mg/sem", "horario": null, "observacao": "%s"},
                                 {"nome": ""}]}}]}""".formatted(longo, longo));

        ConteudoDieta dieta = DecodificadorDaProposta.decodificar(json, raiz, contexto()).grupos().getFirst().dieta();

        assertThat(dieta.refeicoes()).isEmpty();
        assertThat(dieta.suplementacao()).singleElement().satisfies(s -> {
            assertThat(s.nome()).isEqualTo("Creatina");
            assertThat(s.dose()).isEqualTo("5 g");
            assertThat(s.horario()).isEqualTo("pos treino");
            assertThat(s.observacao()).hasSize(500);
            assertThat(s.link()).isNull();
            assertThat(s.cupom()).isNull();
        });
        assertThat(dieta.ergogenicos()).singleElement().satisfies(e -> {
            assertThat(e.nome()).isEqualTo("Testosterona enantato");
            assertThat(e.principioAtivo()).isEqualTo("testosterona");
            assertThat(e.concentracao()).isEqualTo("250 mg/ml");
            assertThat(e.dose()).isEqualTo("250 mg/sem");
            assertThat(e.horario()).isNull();
            assertThat(e.observacao()).hasSize(500);
            assertThat(e.prescricao()).isNull();
        });
    }

    @Test
    void grupoSoComMedicacaoEAproveitavel() {
        JsonMapper json = JsonMapper.builder().build();
        JsonNode raiz = json.readTree("""
                {"grupos": [{"nomeAluno": null, "dieta": {"medicacoes": [{"nome": "Medicamento Ficticio", "dose": "1 cp"}]}}]}""");

        ResultadoInterpretacao r = DecodificadorDaProposta.decodificar(json, raiz, contexto());

        assertThat(r.grupos()).hasSize(1);
        assertThat(r.grupos().getFirst().dieta().refeicoes()).isEmpty();
        assertThat(r.grupos().getFirst().dieta().ergogenicos()).hasSize(1);
        assertThat(r.grupos().getFirst().treino()).isNull();
    }

    @Test
    void contextoDeSeteArgumentosTemBibliotecasVaziasENuncaNulas() {
        ContextoIa c = new ContextoIa("a.pdf", "PDF", List.of(), "Sentinela Qwz", null, List.of(), Map.of());
        assertThat(c.exerciciosDaBiblioteca()).isEmpty();
        assertThat(c.alimentosDaBiblioteca()).isEmpty();

        ContextoIa comNulos = new ContextoIa("a.pdf", "PDF", List.of(), "Sentinela Qwz", null, List.of(), Map.of(), null, null);
        assertThat(comNulos.exerciciosDaBiblioteca()).isEmpty();

        ContextoIa com = c.comBiblioteca(List.of("Supino reto"), List.of("Arroz"));
        assertThat(com.exerciciosDaBiblioteca()).containsExactly("Supino reto");
        assertThat(com.alimentosDaBiblioteca()).containsExactly("Arroz");
        assertThat(com.toString()).doesNotContain("Supino").doesNotContain("Sentinela Qwz");
    }

    @Test
    void roteadorMandaABibliotecaAoConectorDaIaESoDepoisDoFailClosed() {
        InterpretadorPorRegras regrasComBiblioteca = spy(new InterpretadorPorRegras());
        doReturn(List.of("Supino reto")).when(regrasComBiblioteca).nomesDeExercicios();
        doReturn(List.of("Arroz")).when(regrasComBiblioteca).nomesDeAlimentos();
        when(gemini.interpretar(any())).thenReturn(new ResultadoInterpretacao(List.of(), List.of()));

        new RoteadorInterpretadorIa(config("gemini", true), gemini, claude, regrasComBiblioteca)
                .interpretarComModo(contexto());

        ArgumentCaptor<ContextoIa> enviado = ArgumentCaptor.forClass(ContextoIa.class);
        verify(gemini).interpretar(enviado.capture());
        assertThat(enviado.getValue().exerciciosDaBiblioteca()).containsExactly("Supino reto");
        assertThat(enviado.getValue().alimentosDaBiblioteca()).containsExactly("Arroz");

        // Envio desligado: nem a biblioteca é buscada.
        InterpretadorPorRegras regrasDesligado = spy(new InterpretadorPorRegras());
        new RoteadorInterpretadorIa(config("claude", false), gemini, claude, regrasDesligado).interpretarComModo(contexto());
        verify(regrasDesligado, never()).nomesDeExercicios();
        verify(regrasDesligado, never()).nomesDeAlimentos();
    }

    @Test
    void promptsTrazemABibliotecaCortadaEAMetodologia() {
        List<String> muitos = java.util.stream.IntStream.range(0, 1600).mapToObj(i -> "Exercicio " + i).toList();
        ContextoIa c = contexto().comBiblioteca(muitos, List.of("Arroz"));
        c = new ContextoIa(c.nomeArquivo(), c.formato(), c.blocos(), c.textoParaProvedor(), c.objetivo(),
                List.of("WORKING = WS (TRABALHO)"), c.apelidosConhecidos(), c.exerciciosDaBiblioteca(),
                c.alimentosDaBiblioteca());

        String trecho = DecodificadorDaProposta.trechoDeMetodologiaEBiblioteca(c);

        assertThat(trecho).contains("WORKING = WS (TRABALHO)").contains("CODIGO").contains("Exercicio 1499")
                .doesNotContain("Exercicio 1500").contains("Arroz").contains("exatamente o nome da lista");
    }

    @Test
    void respostaCortadaDoProvedorViraMotivoProprioEcaiNasRegras() {
        when(claude.interpretar(any())).thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config("claude", true), gemini, claude, regras);

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador.interpretarComModo(contexto());

        assertThat(exec.modoEfetivo()).isEqualTo("REGRAS");
        assertThat(exec.fallbackParaRegras()).isTrue();
        assertThat(exec.motivoFallback()).isEqualTo("RESPOSTA_CORTADA");
    }

    @Test
    void respostaSemNenhumAlunoAproveitavelFalhaParaCairNasRegras() {
        JsonMapper json = JsonMapper.builder().build();
        JsonNode raiz = json.readTree("""
                {"grupos": [{"aluno": "x", "sessao": "Treino A"}, {}], "duvidas": []}""");

        assertThatThrownBy(() -> DecodificadorDaProposta.decodificar(json, raiz, contexto()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void falhaPassageiraDoProvedorTentaDeNovoUmaVezEVoltaAIa() {
        when(gemini.interpretar(any())).thenThrow(new FalhaPassageiraDoProvedor("429"))
                .thenReturn(new ResultadoInterpretacao(List.of(), List.of()));
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config("gemini", true), gemini, claude, regras);
        roteador.espera = java.time.Duration.ZERO;

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador.interpretarComModo(contexto());

        verify(gemini, org.mockito.Mockito.times(2)).interpretar(any());
        assertThat(exec.modoEfetivo()).isEqualTo("IA");
        assertThat(exec.fallbackParaRegras()).isFalse();
    }

    @Test
    void duasFalhasPassageirasVoltamParaRegrasSemTerceiraTentativa() {
        when(gemini.interpretar(any())).thenThrow(new FalhaPassageiraDoProvedor("503"));
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config("gemini", true), gemini, claude, regras);
        roteador.espera = java.time.Duration.ZERO;

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador.interpretarComModo(contexto());

        verify(gemini, org.mockito.Mockito.times(2)).interpretar(any());
        assertThat(exec.motivoFallback()).isEqualTo("ERRO_PROVEDOR");
    }

    @Test
    void respostaCortadaNuncaTentaDeNovo() {
        when(claude.interpretar(any())).thenThrow(new DecodificadorDaProposta.RespostaCortada("Claude"));
        RoteadorInterpretadorIa roteador = new RoteadorInterpretadorIa(config("claude", true), gemini, claude, regras);
        roteador.espera = java.time.Duration.ZERO;

        RoteadorInterpretadorIa.ExecucaoInterpretacao exec = roteador.interpretarComModo(contexto());

        verify(claude).interpretar(any());
        assertThat(exec.motivoFallback()).isEqualTo("RESPOSTA_CORTADA");
    }

    @Test
    void statusPassageiroSoParaLimiteEErroDoServidor() {
        assertThat(FalhaPassageiraDoProvedor.statusPassageiro(429)).isTrue();
        assertThat(FalhaPassageiraDoProvedor.statusPassageiro(503)).isTrue();
        assertThat(FalhaPassageiraDoProvedor.statusPassageiro(400)).isFalse();
        assertThat(FalhaPassageiraDoProvedor.statusPassageiro(401)).isFalse();
    }

    @Test
    void cortePorArquivoCobreUmaChamadaInteiraDoClaude() {
        assertThat(RoteadorInterpretadorIa.TEMPO_MAXIMO_POR_ARQUIVO)
                .isGreaterThan(InterpretadorClaude.TIMEOUT_HTTP.multipliedBy(2));
    }
}
