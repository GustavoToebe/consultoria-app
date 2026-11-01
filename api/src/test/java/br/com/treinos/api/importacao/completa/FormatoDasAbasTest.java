package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.importacao.completa.FormatoDasAbas.Bloco;
import br.com.treinos.api.importacao.completa.FormatoDasAbas.FormatoDaAba;
import br.com.treinos.api.importacao.completa.FormatoDasAbas.Separacao;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlimentoDaBiblioteca;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlunoExistente;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Contexto;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Montagem;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Permissoes;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PlanosDoAluno;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Analise;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.BlocoDaAba;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas.Reconhecimento;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ConteudoTreino.ExercicioPlano;
import br.com.treinos.api.treino.ConteudoTreino.Serie;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linha;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Os formatos da fase 2 (01/11): uma aba por aluno e vários alunos em blocos numa aba. Planilhas fictícias geradas aqui
 * mesmo; nomes inventados.
 */
class FormatoDasAbasTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 11, 1);
    private static final Permissoes TODAS = new Permissoes(true, true, true, true, true);

    private static Separacao separar(String nome, List<List<Object>> linhas) {
        List<Linha> lidas = PlanilhaDeTeste.linhas(linhas);
        Reconhecimento r = ReconhecimentoDeAbas.reconhecer(lidas);
        return FormatoDasAbas.separar(nome, lidas, r);
    }

    private static Montagem montar(Map<String, List<List<Object>>> abas, List<AlunoExistente> alunos, Long vagas,
                                   RespostasDaPlanilha respostas) {
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler("planilha.xlsx", PlanilhaDeTeste.xlsx(abas));
        Contexto ctx = new Contexto(List.of(), List.of(new AlimentoDaBiblioteca(UUID.randomUUID(), "Aveia fictícia")), List.of(),
                List.of(), alunos, null, vagas, TODAS, HOJE, v -> v.startsWith("https://youtu.be/"));
        return MontagemDaImportacao.montar(leitura, respostas, ctx);
    }

    private static Analise analisar(Map<String, List<List<Object>>> abas, List<String> existentes) {
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler("planilha.xlsx", PlanilhaDeTeste.xlsx(abas));
        return AnaliseDaPlanilha.analisar(leitura, List.of(), List.of(), List.of(), List.of(), existentes, HOJE);
    }

    private static PlanosDoAluno planosDe(Montagem m, String nome) {
        return m.planos().stream().filter(p -> nome.equals(p.nome())).findFirst().orElseThrow();
    }

    // ----------------------------------------------------------------------------------- nome da aba e títulos

    @Test
    void nomeDaAbaQueEDeAluno() {
        assertThat(FormatoDasAbas.alunoDoNomeDaAba("Ana Fictícia")).contains("Ana Fictícia");
        assertThat(FormatoDasAbas.alunoDoNomeDaAba("Treino - Bruno Inventado")).contains("Bruno Inventado");
        assertThat(FormatoDasAbas.alunoDoNomeDaAba("Dieta da Carla")).contains("Carla");
        assertThat(FormatoDasAbas.alunoDoNomeDaAba("Davi Exemplo - Treino")).contains("Davi Exemplo");
        assertThat(FormatoDasAbas.alunoDoNomeDaAba("Aluno: Eva")).contains("Eva");
        for (String generico : List.of("Treino", "Treinos", "Treino A", "Dieta", "Exercícios", "TACO", "Planilha1", "Sheet1",
                "Peito e Tríceps", "Hipertrofia", "Pesos", "A", "Café da manhã", "Segunda-feira")) {
            assertThat(FormatoDasAbas.alunoDoNomeDaAba(generico)).as(generico).isEmpty();
        }
    }

    @Test
    void tituloDeAlunoOuDeDivisao() {
        assertThat(FormatoDasAbas.alunoDoTitulo("Nome: Fábio Teste 2")).contains("Fábio Teste 2"); // com rótulo, sempre
        assertThat(FormatoDasAbas.alunoDoTitulo("Gabi Fictícia")).contains("Gabi Fictícia");
        assertThat(FormatoDasAbas.alunoDoTitulo("Treino A - Peito")).isEmpty();
        assertThat(FormatoDasAbas.alunoDoTitulo("Lanche da tarde")).isEmpty();
        assertThat(FormatoDasAbas.alunoDoTitulo("Dia 1")).isEmpty();
    }

    @Test
    void abaComColunaDoAlunoContinuaTabela() {
        Separacao s = separar("Ana Fictícia", List.of(linha("Aluno", "Exercício", "Séries"), linha("Ana", "Supino", 3)));
        assertThat(s.formato()).isEqualTo(FormatoDaAba.TABELA);
        // Sem aluno no nome da aba nem nos títulos, também.
        assertThat(separar("Treinos", List.of(linha("Exercício", "Séries"), linha("Supino", 3))).formato())
                .isEqualTo(FormatoDaAba.TABELA);
    }

    @Test
    void umAlunoPorAbaComTitulosDeDivisao() {
        Separacao s = separar("Ana Fictícia", List.of(
                linha("Treino A - Peito"),
                linha("Exercício", "Séries", "Repetições"),
                linha("Supino fictício", 4, "8-12"),
                linha("Crucifixo fictício", 3, 12),
                linha("Treino B - Costas"),
                linha("Exercício", "Séries", "Repetições"),
                linha("Remada fictícia", 3, "10")));
        assertThat(s.formato()).isEqualTo(FormatoDaAba.UM_ALUNO);
        assertThat(s.blocos()).extracting(Bloco::aluno).containsOnly("Ana Fictícia");
        assertThat(s.blocos()).extracting(Bloco::titulo).containsExactly("Treino A - Peito", "Treino B - Costas");
        assertThat(s.blocos()).extracting(b -> b.dados().size()).containsExactly(2, 1);
        assertThat(s.blocos()).extracting(Bloco::linhaDoCabecalho).containsExactly(2, 6);
    }

    @Test
    void variosAlunosEmBlocos() {
        Separacao s = separar("Treinos", List.of(
                linha("Aluno: Bruno Inventado"),
                linha("Exercício", "Prescrição"),
                linha("Agachamento fictício", "4x10"),
                linha("Carla Exemplo"),
                linha("Treino A"),
                linha("Exercício", "Prescrição"),
                linha("Leg press fictício", "3x12"),
                linha("Treino B"),
                linha("Exercício", "Prescrição"),
                linha("Puxada fictícia", "10-8-6")));
        assertThat(s.formato()).isEqualTo(FormatoDaAba.BLOCOS);
        assertThat(s.blocos()).extracting(Bloco::aluno).containsExactly("Bruno Inventado", "Carla Exemplo", "Carla Exemplo");
        assertThat(s.blocos()).extracting(Bloco::titulo).containsExactly(null, "Treino A", "Treino B");
        assertThat(s.blocos()).allMatch(b -> b.dados().size() == 1);
    }

    // ------------------------------------------------------------------------------------- montagem e análise

    private static Map<String, List<List<Object>>> umaAbaPorAluno() {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Ana Fictícia", List.of(
                linha("Treino A"),
                linha("Exercício", "Séries", "Repetições", "Descanso"),
                linha("Supino fictício", 4, "8-12", "90s"),
                linha("Crucifixo fictício", 3, "12-10-8", "1 min"),
                linha("Treino B"),
                linha("Exercício", "Séries", "Repetições", "Descanso"),
                linha("Remada fictícia", 3, 10, "livre")));
        abas.put("Dieta - Ana Fictícia", List.of(
                linha("Café da manhã"),
                linha("Alimento", "Quantidade", "Kcal"),
                linha("Aveia fictícia", 30, 110),
                linha("Almoço"),
                linha("Alimento", "Quantidade", "Kcal"),
                linha("Arroz fictício", 100, 130)));
        abas.put("Bruno Inventado", List.of(
                linha("Exercício", "Prescrição"),
                linha("Agachamento fictício", "3x30s"),
                linha("Prancha fictícia", "3x10 rest pause")));
        return abas;
    }

    @Test
    void umaAbaPorAlunoMontaOTreinoEADietaDeCadaUm() {
        Montagem m = montar(umaAbaPorAluno(), List.of(), null, RespostasDaPlanilha.VAZIAS);
        assertThat(m.alunosNovos()).extracting(MontagemDaImportacao.AlunoNovo::nome)
                .containsExactlyInAnyOrder("Ana Fictícia", "Bruno Inventado");
        assertThat(m.alunosNovos()).allMatch(a -> a.ativo() && a.email() == null && a.linha() == null);

        PlanosDoAluno ana = planosDe(m, "Ana Fictícia");
        assertThat(ana.treino().sessoes()).extracting(ConteudoTreino.Sessao::nome).containsExactly("Treino A", "Treino B");
        ExercicioPlano supino = ana.treino().sessoes().getFirst().exercicios().getFirst();
        assertThat(supino.series()).hasSize(4).allMatch(s -> s.repsMin() == 8 && s.repsMax() == 12 && s.descansoSegundos() == 90);
        ExercicioPlano crucifixo = ana.treino().sessoes().getFirst().exercicios().get(1);
        assertThat(crucifixo.series()).extracting(Serie::repsMin).containsExactly(12, 10, 8);
        assertThat(crucifixo.series()).allMatch(s -> s.descansoSegundos() == 60);
        ExercicioPlano remada = ana.treino().sessoes().get(1).exercicios().getFirst();
        assertThat(remada.series()).allMatch(s -> s.descansoSegundos() == null);
        assertThat(remada.observacao()).contains("Descanso: livre"); // não entendido: fica na observação
        // A dieta de outra aba, com o mesmo aluno, entra na mesma pasta; o título do bloco é a refeição.
        assertThat(ana.dieta().refeicoes()).extracting(ConteudoDieta.Refeicao::nome).containsExactly("Café da manhã", "Almoço");
        assertThat(ana.dieta().refeicoes().getFirst().opcoes().getFirst().itens().getFirst().alimentoId()).isNotNull();

        PlanosDoAluno bruno = planosDe(m, "Bruno Inventado");
        assertThat(bruno.dieta()).isNull();
        ExercicioPlano agachamento = bruno.treino().sessoes().getFirst().exercicios().getFirst();
        assertThat(agachamento.series()).hasSize(3).allMatch(s -> s.repsMin() == null);
        assertThat(agachamento.observacao()).contains("Duração de cada série: 30 s");
        ExercicioPlano prancha = bruno.treino().sessoes().getFirst().exercicios().get(1);
        assertThat(prancha.series()).allMatch(s -> s.tecnica() != null && "REST_PAUSE".equals(s.tecnica().tipo()));
        assertThat(prancha.observacao()).contains("Prescrição na planilha: 3x10 rest pause");

        // O histórico não guarda o nome do aluno que está no nome da aba.
        assertThat(m.abasComNomeDeAluno()).containsEntry("Ana Fictícia", "Aba 1").containsEntry("Dieta - Ana Fictícia", "Aba 2");
    }

    @Test
    void alunoQueJaExisteEReaproveitadoPeloNomeDaAba() {
        UUID ana = UUID.randomUUID();
        Montagem m = montar(umaAbaPorAluno(), List.of(new AlunoExistente(ana, "ana fictícia", null, false, Set.of())), null,
                RespostasDaPlanilha.VAZIAS);
        assertThat(m.alunosReaproveitados()).isEqualTo(1);
        assertThat(m.alunosNovos()).extracting(MontagemDaImportacao.AlunoNovo::nome).containsExactly("Bruno Inventado");
        assertThat(m.planos()).anyMatch(p -> ana.equals(p.dono().existente()) && p.treino() != null && p.dieta() != null);
    }

    @Test
    void limiteDoPlanoEAlunoAmbiguoNaoEntram() {
        Montagem limite = montar(umaAbaPorAluno(), List.of(), 1L, RespostasDaPlanilha.VAZIAS);
        assertThat(limite.alunosNovos()).hasSize(1);
        assertThat(limite.problemas()).anyMatch(p -> "LIMITE_DO_PLANO".equals(p.tipo()) && "ALUNO".equals(p.campo()));

        List<AlunoExistente> dois = List.of(new AlunoExistente(UUID.randomUUID(), "Bruno Inventado", null, false, Set.of()),
                new AlunoExistente(UUID.randomUUID(), "Bruno Inventado", null, false, Set.of()));
        Montagem ambiguo = montar(umaAbaPorAluno(), dois, null, RespostasDaPlanilha.VAZIAS);
        assertThat(ambiguo.planos()).noneMatch(p -> "Bruno Inventado".equals(p.nome()));
        assertThat(ambiguo.problemas()).anyMatch(p -> "ALUNO_EXISTENTE_AMBIGUO".equals(p.tipo()) && p.aba().equals("Bruno Inventado"));
    }

    @Test
    void abaIgnoradaNaoCriaOAluno() {
        RespostasDaPlanilha r = new RespostasDaPlanilha(List.of(new RespostasDaPlanilha.TipoDaAba(2, "IGNORAR")), List.of(),
                List.of(), List.of(), List.of());
        Montagem m = montar(umaAbaPorAluno(), List.of(), null, r);
        assertThat(m.alunosNovos()).extracting(MontagemDaImportacao.AlunoNovo::nome).containsExactly("Ana Fictícia");
    }

    @Test
    void blocosComAAbaDeAlunosDaPlanilha() {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put("Alunos", List.of(linha("Nome", "Email"), linha("Carla Exemplo", "carla@example.com")));
        abas.put("Treinos", List.of(
                linha("Carla Exemplo"),
                linha("Exercício", "Prescrição"),
                linha("Leg press fictício", "3x12 RIR 2"),
                linha("Davi Inventado"),
                linha("Exercício", "Prescrição"),
                linha("Puxada fictícia", "4x10 desc 60s")));
        Montagem m = montar(abas, List.of(), null, RespostasDaPlanilha.VAZIAS);
        assertThat(m.alunosNovos()).extracting(MontagemDaImportacao.AlunoNovo::nome).containsExactly("Carla Exemplo", "Davi Inventado");
        PlanosDoAluno carla = m.planos().stream().filter(p -> p.dono().linha() != null && p.dono().linha() == 2).findFirst()
                .orElseThrow();
        assertThat(carla.treino().sessoes().getFirst().exercicios().getFirst().series())
                .hasSize(3).allMatch(s -> s.esforco().rir() == 2);
        PlanosDoAluno davi = planosDe(m, "Davi Inventado");
        assertThat(davi.treino().sessoes().getFirst().exercicios().getFirst().series()).allMatch(s -> s.descansoSegundos() == 60);
        // "Treinos" não é nome de aluno: o histórico guarda o nome da aba como está.
        assertThat(m.abasComNomeDeAluno()).isEmpty();

        Analise a = analisar(abas, List.of());
        PlanilhaCompletaDtos.Aba treinos = a.abas().get(1);
        assertThat(treinos.formato()).isEqualTo("BLOCOS");
        assertThat(treinos.blocos()).extracting(BlocoDaAba::aluno).containsExactly("Carla Exemplo", "Davi Inventado");
        assertThat(treinos.blocos()).extracting(BlocoDaAba::situacao).containsExactly("PLANILHA", "NOVO");
        assertThat(a.resumo().exercicios()).isEqualTo(2);
        assertThat(a.resumo().treinos()).isEqualTo(2);
    }

    @Test
    void analiseDizOFormatoEDeQuemEACadaAba() {
        Analise a = analisar(umaAbaPorAluno(), List.of("Bruno Inventado"));
        assertThat(a.abas()).extracting(PlanilhaCompletaDtos.Aba::formato).containsExactly("UM_ALUNO", "UM_ALUNO", "UM_ALUNO");
        assertThat(a.abas().get(0).blocos()).extracting(BlocoDaAba::titulo).containsExactly("Treino A", "Treino B");
        assertThat(a.abas().get(1).tipo()).isEqualTo("DIETA");
        assertThat(a.abas().get(1).blocos()).extracting(BlocoDaAba::aluno).containsOnly("Ana Fictícia");
        assertThat(a.abas().get(2).blocos()).extracting(BlocoDaAba::situacao).containsExactly("EXISTENTE");
        assertThat(a.abas().get(0).blocos()).extracting(BlocoDaAba::situacao).containsOnly("NOVO");
        assertThat(a.resumo().treinos()).isEqualTo(3);
        assertThat(a.resumo().refeicoes()).isEqualTo(2);
        // Nenhuma aba sem ligação: o aluno é o do nome da aba.
        assertThat(a.problemas()).noneMatch(p -> "ABA_SEM_LIGACAO".equals(p.tipo()));
    }
}
