package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Analise;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Pergunta;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Problema;
import br.com.treinos.api.web.ValidacaoException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linha;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A análise inteira sobre um .xlsx fictício gerado aqui, sem banco (a biblioteca vem como lista de nomes). */
class AnaliseDaPlanilhaTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 10, 31);

    private static Analise analisar(Map<String, List<List<Object>>> abas, List<String> biblioteca) {
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler("planilha.xlsx", PlanilhaDeTeste.xlsx(abas));
        return AnaliseDaPlanilha.analisar(leitura, biblioteca, List.of("Aveia fictícia"), HOJE);
    }

    @Test
    void analisaAPlanilhaDoTreinador() {
        Analise a = analisar(PlanilhaDeTeste.abasDoTreinador(), List.of("Supino reto com halteres"));
        assertThat(a.abas()).extracting(PlanilhaCompletaDtos.Aba::tipo).containsExactly("ALUNOS", "PESOS", "PLANOS_DE_DIETA",
                "DIETA", "SUPLEMENTOS", "ROTINAS", "TREINO", "LISTA_DE_EXERCICIOS", "TABELA_DE_ALIMENTOS");
        assertThat(a.abas().getFirst().campos()).containsEntry("CODIGO", 0).containsEntry("ALUNO", 1);
        assertThat(a.abas().getFirst().linhas()).isEqualTo(5);
        assertThat(a.ligacoes()).hasSize(6);

        var r = a.resumo();
        assertThat(r.alunos()).isEqualTo(5);
        // P1 e P2 (o resto de conta volta a 79,9); P6 é de um aluno que não está no cadastro.
        assertThat(r.pesos()).isEqualTo(2);
        assertThat(r.exercicios()).isEqualTo(7);
        assertThat(r.treinos()).isEqualTo(3); // R1-A, R1-B e R9-A
        assertThat(r.itensDeDieta()).isEqualTo(4);
        assertThat(r.refeicoes()).isEqualTo(3); // P1 refeição 1, P1 refeição 2, P2 refeição 1
        assertThat(r.suplementos()).isEqualTo(2);
        assertThat(r.exerciciosNaLista()).isEqualTo(2);
        assertThat(r.faixasRecuperadasDeData()).isEqualTo(1);
        assertThat(r.prescricoesNaoEntendidas()).isEqualTo(2); // "qualquer coisa" e a data de 1999
        assertThat(r.nomesDeExercicio().certo()).isEqualTo(3); // Remada e Puxada (lista da planilha) e Supino (biblioteca)
        assertThat(r.nomesDeAlimento().certo()).isEqualTo(1);

        assertThat(a.problemasPorTipo()).containsEntry("EMAIL_INVALIDO", 1).containsEntry("SEM_DATA", 1)
                .containsEntry("DATA_NO_FUTURO", 1).containsEntry("PESO_INVALIDO", 1).containsEntry("EXERCICIO_SEM_NOME", 1)
                .containsEntry("ITEM_SEM_ALIMENTO", 1).containsEntry("SUPLEMENTO_SEM_NOME", 1)
                .containsEntry("PRESCRICAO_NAO_ENTENDIDA", 1).containsEntry("REPETICOES_VIROU_DATA", 1)
                .containsEntry("QUANTIDADE_DE_SERIES_INVALIDA", 1).containsEntry("LINHA_SEM_LIGACAO", 3);
        assertThat(a.problemas()).contains(new Problema("Histórico Pesos", 7, "ALUNO_CODIGO", "LINHA_SEM_LIGACAO"),
                new Problema("Treinos_Exercicios", 8, "ROTINA_CODIGO", "LINHA_SEM_LIGACAO"),
                new Problema("Treinos_Exercicios", 6, "REPETICOES", "PRESCRICAO_NAO_ENTENDIDA"));

        assertThat(a.exercicios()).extracting(Pergunta::nome).contains("Xyzzy qwerty", "Exercício data", "Impossível");
        assertThat(a.exercicios()).extracting(Pergunta::nome).doesNotContain("Remada fictícia", "Supino reto c/ hal.");
        Pergunta xyzzy = a.exercicios().stream().filter(p -> p.nome().equals("Xyzzy qwerty")).findFirst().orElseThrow();
        assertThat(xyzzy.nivel()).isEqualTo("NENHUM");
        assertThat(xyzzy.sugestao()).isNull();
        assertThat(a.alimentos()).extracting(Pergunta::nome).contains("Feijão fictício").doesNotContain("Aveia fictícia");
    }

    private static final List<Object> CAB_ALUNOS = PlanilhaDeTeste.CAB_ALUNOS;
    private static final List<Object> CAB_PESOS = PlanilhaDeTeste.CAB_PESOS;

    private static Problema problema(String aba, int linha, String tipo) {
        return new Problema(aba, linha, null, tipo);
    }

    private static List<Problema> semCampo(List<Problema> problemas) {
        return problemas.stream().map(p -> problema(p.aba(), p.linha(), p.tipo())).toList();
    }

    @Test
    void paridadeComAPlanilhaFicticiaDoConversorDeAlunos() {
        // O mesmo caso do "converte a planilha fictícia: alunos, pesos, peso inicial e problemas" do planilha.test.mjs.
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Resumo", List.of(linha("Planilha fictícia de teste")));
        abas.put("Alunos", List.of(CAB_ALUNOS,
                linha("ALU001", "Aluno  Teste 1", " Aluno.Teste1@Example.com ", "(45) 90000-0001", 80.5, "Objetivo fictício",
                        PlanilhaDeTeste.data("2026-01-05"), "Ativo", "Obs fictícia"),
                linha("ALU002", "Aluna Teste 2", "nao-e-email", null, "64,2", null, PlanilhaDeTeste.data("2026-02-01"),
                        "Inativo", null),
                linha("ALU003", "Aluno Teste 3", null, null, null, null, null, "ativa", null),
                linha(null, "Aluno Teste Sem Id", null, null, null, null, null, "Ativo", null),
                linha(),
                linha("ALU001", "Aluno Teste Repetido", null, null, null, null, null, null, null),
                linha("ALU004", "Aluno Teste 4", null, null, 70, null, null, "Ativo", null),
                linha("ALU005", null, null, null, null, null, null, null, null)));
        abas.put("Histórico Pesos", List.of(CAB_PESOS,
                linha("P1", "ALU001", "Aluno Teste 1", PlanilhaDeTeste.data("2026-01-05"), 1, 80.5, null, null),
                linha("P2", "ALU001", "Aluno Teste 1", PlanilhaDeTeste.data("2026-01-12"), 2, 79.9000000001, -0.6,
                        "Observação; fictícia"),
                linha("P3", "ALU001", "Aluno Teste 1", null, 3, 79.5, null, null),
                linha("P4", "ALU001", "Aluno Teste 1", PlanilhaDeTeste.data("2099-01-01"), 4, 79, null, null),
                linha("P5", "ALU002", "Aluna Teste 2", PlanilhaDeTeste.data("2026-02-08"), 1, new PlanilhaDeTeste.Erro("#REF!"),
                        null, null),
                linha("P6", "ALU009", "Aluno Teste 9", PlanilhaDeTeste.data("2026-02-08"), 1, 90, null, null),
                linha("P7", null, "Aluno Teste 1", PlanilhaDeTeste.data("2026-02-08"), 1, 90, null, null),
                linha("P8", "ALU002", "Aluna Teste 2", "15/02/2026", 2, "63,8", null, null),
                linha("P9", "ALU001", "Aluno Teste 1", PlanilhaDeTeste.data("2026-01-12"), 2, 79.8, null, null),
                linha("P10", "ALU005", "Aluno Teste 5", PlanilhaDeTeste.data("2026-02-08"), 1, 70, null, null),
                linha("P11", "ALU003", "Aluno Teste 3", PlanilhaDeTeste.data("2026-03-01"), 1, 81.955, null, null),
                linha("P12", "ALU003", "Aluno Teste 3", "ontem", 1, 81, null, null)));
        Analise a = analisar(abas, List.of());
        // Os mesmos 14 problemas, nas mesmas linhas e na mesma ordem (o script escreve o motivo; aqui é o tipo).
        assertThat(semCampo(a.problemas())).containsExactly(
                problema("Alunos", 3, "EMAIL_INVALIDO"),
                problema("Alunos", 5, "ALUNO_SEM_CODIGO"),
                problema("Alunos", 7, "CODIGO_REPETIDO"),
                problema("Alunos", 8, "PESO_INICIAL_SEM_DATA"),
                problema("Alunos", 9, "ALUNO_SEM_NOME"),
                problema("Histórico Pesos", 4, "SEM_DATA"),
                problema("Histórico Pesos", 5, "DATA_NO_FUTURO"),
                problema("Histórico Pesos", 6, "PESO_INVALIDO"),
                problema("Histórico Pesos", 7, "LINHA_SEM_LIGACAO"),
                problema("Histórico Pesos", 8, "SEM_REFERENCIA"),
                problema("Histórico Pesos", 10, "PESO_REPETIDO"),
                problema("Histórico Pesos", 11, "ALUNO_FORA"),
                problema("Histórico Pesos", 12, "PESO_INVALIDO"),
                problema("Histórico Pesos", 13, "DATA_INVALIDA"));
        // contagens do script: { alunos: 4, inativos: 1, pesos: 4, pesosIniciais: 1, iniciaisNoHistorico: 1 }, onde os 4
        // pesos são os 3 do histórico mais o peso inicial que o histórico não tem.
        var r = a.resumo();
        assertThat(r.alunos()).isEqualTo(4);
        assertThat(r.alunosInativos()).isEqualTo(1);
        assertThat(r.pesos() + r.pesosIniciais()).isEqualTo(4);
        assertThat(r.pesosIniciais()).isEqualTo(1);
        assertThat(r.pesosIniciaisNoHistorico()).isEqualTo(1);
        assertThat(a.toString()).doesNotContain("Aluno Teste", "Aluna Teste", "example.com", "nao-e-email", "fictícia", "(45)");
    }

    @Test
    void paridadeTituloAcimaEOutrosCasosDoConversorDeAlunos() {
        // "primeira célula do cabeçalho com um ID no lugar de ID, título acima e aba com outro nome de caixa"
        Map<String, List<List<Object>>> titulo = new LinkedHashMap<>();
        titulo.put("ALUNOS", List.of(linha("Cadastro (fictício)"), linha(), linha("ALU000", "Nome", "Email", "Status"),
                linha("ALU010", "Aluno Teste 10", null, "Pausado")));
        titulo.put("historico pesos", List.of(linha("ALU000", "ID Aluno", "Data", "Peso (kg)"),
                linha("P1", "ALU010", PlanilhaDeTeste.data("2026-05-01"), 70)));
        Analise a = analisar(titulo, List.of());
        assertThat(a.resumo().alunos()).isEqualTo(1);
        assertThat(a.resumo().pesos()).isEqualTo(1);
        assertThat(a.resumo().alunosInativos()).isEqualTo(1);
        assertThat(a.problemas()).isEmpty();

        // "nome repetido é anotado e mantido; peso inicial na mesma data do histórico não duplica"
        Map<String, List<List<Object>>> repetido = new LinkedHashMap<>();
        repetido.put("Alunos", List.of(CAB_ALUNOS,
                linha("A1", "Aluno Teste", null, null, 80, null, PlanilhaDeTeste.data("2026-01-01")),
                linha("A2", "aluno  teste", null, null, null, null, null)));
        repetido.put("Histórico Pesos", List.of(CAB_PESOS, linha("P1", "A1", null, PlanilhaDeTeste.data("2026-01-01"), 1, 79)));
        Analise b = analisar(repetido, List.of());
        assertThat(b.resumo().alunos()).isEqualTo(2);
        assertThat(semCampo(b.problemas())).containsExactly(problema("Alunos", 3, "NOME_REPETIDO"));
        assertThat(b.resumo().pesos()).isEqualTo(1);
        assertThat(b.resumo().pesosIniciais()).isZero();
        assertThat(b.resumo().pesosIniciaisNoHistorico()).isEqualTo(1);

        // "\"x\" (ou \"-\") no lugar do e-mail vale como sem e-mail, sem virar problema"
        Map<String, List<List<Object>>> semEmail = new LinkedHashMap<>();
        semEmail.put("Alunos", List.of(CAB_ALUNOS, linha("A1", "Aluno Teste 1", "x", null, null, null, null),
                linha("A2", "Aluno Teste 2", " - ", null, null, null, null)));
        semEmail.put("Histórico Pesos", List.of(CAB_PESOS));
        assertThat(analisar(semEmail, List.of()).problemas()).isEmpty();
    }

    @Test
    void aRespostaNaoLevaDadoDeAluno() {
        Analise a = analisar(PlanilhaDeTeste.abasDoTreinador(), List.of());
        String tudo = a.toString();
        for (String proibido : List.of("Aluno Um", "Aluno Dois", "um@example.com", "nao-e-email", "80.5", "79.9", "81.955",
                "Intra fictício", "Muita água", "Observação geral", "Obs rotina", "Remédio Fictício", "Creatina", "5 g",
                "Algo de terceiros", "Pode trocar")) {
            assertThat(tudo).as(proibido).doesNotContain(proibido);
        }
    }

    @Test
    void planilhaDeOutroTreinadorSemCodigos() {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Clientes", List.of(linha("Cliente", "WhatsApp", "E-mail"),
                linha("Cliente Teste Um", "(45) 99999-0001", "um@exemplo.com"),
                linha("Cliente Teste Dois", "(45) 99999-0002", "dois@exemplo.com")));
        abas.put("Fichas", List.of(linha("Cliente", "Treino", "Exercício", "Séries x Reps", "Carga"),
                linha("Cliente Teste Um", "A", "Supino incl. c/ hal.", "4x10", "20kg"),
                linha("Cliente Teste Um", "A", "Agachamento livre", "3 séries de 8 a 12", null),
                linha("Cliente Teste Dois", "B", "Rosca alternada", "conforme combinado", "12,5 kg")));
        Analise a = analisar(abas, List.of("Supino inclinado com halteres", "Agachamento livre"));
        assertThat(a.abas()).extracting(PlanilhaCompletaDtos.Aba::tipo).containsExactly("ALUNOS", "TREINO");
        assertThat(a.ligacoes()).singleElement().satisfies(l -> {
            assertThat(l.por()).isEqualTo("NOME");
            assertThat(l.ligadas()).isEqualTo(3);
        });
        assertThat(a.resumo().treinos()).isEqualTo(2);
        assertThat(a.resumo().prescricoes()).isEqualTo(5);
        assertThat(a.resumo().prescricoesNaoEntendidas()).isEqualTo(1);
        assertThat(a.resumo().nomesDeExercicio().certo()).isEqualTo(2);
        assertThat(a.resumo().nomesDeExercicio().nenhum()).isEqualTo(1);
    }

    @Test
    void csvTemUmaAbaSo() {
        byte[] csv = "Nome;E-mail\nAluno Teste;teste@exemplo.com\n".getBytes(StandardCharsets.UTF_8);
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler("alunos.csv", csv);
        Analise a = AnaliseDaPlanilha.analisar(leitura, List.of(), List.of(), HOJE);
        assertThat(a.abas()).singleElement().satisfies(x -> assertThat(x.tipo()).isEqualTo("ALUNOS"));
        assertThat(a.resumo().alunos()).isEqualTo(1);
    }

    @Test
    void arquivoQueNaoEPlanilhaERecusadoSemConteudo() {
        assertThatThrownBy(() -> LeituraDasAbas.ler("x.xls", new byte[] {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0}))
                .isInstanceOf(ValidacaoException.class);
        Map<String, List<List<Object>>> muitas = new LinkedHashMap<>();
        for (int i = 0; i <= LeituraDasAbas.ABAS_MAXIMAS; i++) {
            muitas.put("Aba " + i, List.of(linha("x")));
        }
        assertThatThrownBy(() -> LeituraDasAbas.ler("muitas.xlsx", PlanilhaDeTeste.xlsx(muitas)))
                .isInstanceOf(ValidacaoException.class).hasMessageContaining("abas");
    }
}
