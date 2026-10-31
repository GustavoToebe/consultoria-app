package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.dieta.ConteudoDieta;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlimentoDaBiblioteca;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.AlunoExistente;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Contexto;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.ExercicioDaBiblioteca;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Montagem;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.Permissoes;
import br.com.treinos.api.importacao.completa.MontagemDaImportacao.PlanosDoAluno;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.PartePulada;
import br.com.treinos.api.importacao.completa.RespostasDaPlanilha.NomeResolvido;
import br.com.treinos.api.importacao.completa.RespostasDaPlanilha.SuplementoClassificado;
import br.com.treinos.api.treino.ConteudoTreino;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** A montagem da gravação sobre a planilha fictícia do treinador, sem banco (a consultoria vem no {@link Contexto}). */
class MontagemDaImportacaoTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 10, 31);
    private static final Permissoes TODAS = new Permissoes(true, true, true, true, true);
    private static final UUID AVEIA = UUID.randomUUID();

    private static Contexto contexto(Permissoes p, Long vagas, List<String> suplementos, List<AlunoExistente> alunos,
                                     List<ExercicioDaBiblioteca> exercicios) {
        return new Contexto(exercicios, List.of(new AlimentoDaBiblioteca(AVEIA, "Aveia fictícia")), suplementos, List.of(),
                alunos, null, vagas, p, HOJE, v -> v.startsWith("https://youtu.be/"));
    }

    private static Montagem montar(Contexto ctx, RespostasDaPlanilha respostas) {
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler("planilha.xlsx", PlanilhaDeTeste.xlsx(PlanilhaDeTeste.abasDoTreinador()));
        return MontagemDaImportacao.montar(leitura, respostas, ctx);
    }

    private static PlanosDoAluno planosDaLinha(Montagem m, int linha) {
        return m.planos().stream().filter(p -> p.dono().linha() != null && p.dono().linha() == linha).findFirst().orElseThrow();
    }

    @Test
    void montaAlunosPesosExerciciosTreinoEDieta() {
        Montagem m = montar(contexto(TODAS, null, List.of(), List.of(), List.of()), RespostasDaPlanilha.VAZIAS);

        assertThat(m.alunosNovos()).hasSize(5);
        assertThat(m.alunosNovos().get(1).email()).isNull(); // "nao-e-email" não entra
        assertThat(m.pesos()).hasSize(2);
        assertThat(m.pesos()).allMatch(p -> p.dono().linha() == 2);
        assertThat(m.exerciciosNovos()).extracting(MontagemDaImportacao.ExercicioNovo::nome)
                .containsExactly("Puxada fictícia", "Remada fictícia");
        assertThat(m.exerciciosNovos().get(1).videoUrl()).isEqualTo("https://youtu.be/abc123");
        assertThat(m.exerciciosNovos().get(1).grupo()).isEqualTo("Costas");

        // AL1 tem treino e dieta; AL2 só dieta; AL6 tem rotina mas o único exercício está sem nome.
        assertThat(m.planos()).hasSize(2);
        PlanosDoAluno al1 = planosDaLinha(m, 2);
        ConteudoTreino treino = al1.treino();
        assertThat(treino.sessoes()).extracting(ConteudoTreino.Sessao::nome).containsExactly("Segunda - Costas", "Treino B");
        assertThat(treino.sessoes().getFirst().diaSemana()).isEqualTo(1);
        assertThat(treino.sessoes().get(1).diaSemana()).isNull();
        // Pela coluna "Ordem": a puxada (1) antes da remada (2).
        assertThat(treino.sessoes().getFirst().exercicios()).extracting(ConteudoTreino.ExercicioPlano::nome)
                .containsExactly("Puxada fictícia", "Remada fictícia");
        assertThat(treino.sessoes().getFirst().exercicios().get(1).series()).hasSize(5);
        assertThat(treino.sessoes().getFirst().exercicios().get(1).observacao()).contains("Obs fictícia");
        // Sem biblioteca, nada liga (os exercícios novos ligam na confirmação, depois de criados).
        assertThat(treino.sessoes()).flatExtracting(ConteudoTreino.Sessao::exercicios)
                .extracting(ConteudoTreino.ExercicioPlano::exercicioId).containsOnlyNulls();
        assertThat(m.faixasRecuperadasDeData()).isEqualTo(1);

        ConteudoDieta dieta = al1.dieta();
        assertThat(dieta.refeicoes()).extracting(ConteudoDieta.Refeicao::nome).containsExactly("Café fictício", "Almoço fictício");
        assertThat(dieta.refeicoes().getFirst().opcoes().getFirst().itens()).extracting(ConteudoDieta.Item::nome)
                .containsExactly("Ovo fictício", "Pão fictício");
        assertThat(dieta.refeicoes().getFirst().opcoes().getFirst().itens().getFirst().unidade()).isEqualTo("un");
        assertThat(dieta.refeicoes().getFirst().observacao()).contains("Pode trocar");
        // Sem biblioteca de suplementos: tudo vai para a lista sensível e fica pendente.
        assertThat(dieta.suplementacao()).isEmpty();
        assertThat(dieta.ergogenicos()).extracting(ConteudoDieta.Ergogenico::nome)
                .containsExactly("Creatina", "Remédio Fictício XYZ");
        assertThat(m.pendencias().suplementosSemClassificacao()).isEqualTo(2);

        PlanosDoAluno al2 = planosDaLinha(m, 3);
        assertThat(al2.treino()).isNull();
        ConteudoDieta.Item aveia = al2.dieta().refeicoes().getFirst().opcoes().getFirst().itens().getFirst();
        assertThat(aveia.alimentoId()).isEqualTo(AVEIA);
        assertThat(aveia.manual()).isFalse();
        assertThat(aveia.kcal()).isEqualByComparingTo("110");

        assertThat(m.partesPuladas()).isEmpty();
        assertThat(m.problemas()).extracting(PlanilhaCompletaDtos.Problema::tipo)
                .contains("EMAIL_INVALIDO", "SEM_DATA", "DATA_NO_FUTURO", "EXERCICIO_SEM_NOME", "ITEM_SEM_ALIMENTO",
                        "SUPLEMENTO_SEM_NOME", "FAIXA_INVALIDA", "QUANTIDADE_DE_WS_ACIMA_DE_10");
    }

    @Test
    void semPermissaoAParteFicaDeFora() {
        Montagem m = montar(contexto(new Permissoes(false, false, false, false, false), null, List.of(), List.of(), List.of()),
                RespostasDaPlanilha.VAZIAS);
        assertThat(m.alunosNovos()).hasSize(5);
        assertThat(m.alunosNovos()).allMatch(a -> a.objetivo() == null && a.observacoes() == null);
        assertThat(m.pesos()).isEmpty();
        assertThat(m.exerciciosNovos()).isEmpty();
        assertThat(m.planos()).isEmpty();
        assertThat(m.partesPuladas()).extracting(PartePulada::parte)
                .contains("PESOS", "EXERCICIOS", "TREINO", "DIETA", "OBJETIVO_E_OBSERVACOES");
    }

    @Test
    void suplementoConhecidoVaiParaASuplementacaoEMedicacaoPedePermissao() {
        Montagem m = montar(contexto(new Permissoes(true, true, true, true, false), null, List.of("Creatina monohidratada"),
                List.of(), List.of()), RespostasDaPlanilha.VAZIAS);
        ConteudoDieta dieta = planosDaLinha(m, 2).dieta();
        assertThat(dieta.suplementacao()).extracting(ConteudoDieta.Suplemento::nome).containsExactly("Creatina");
        assertThat(dieta.suplementacao().getFirst().dose()).isEqualTo("5 g");
        assertThat(dieta.ergogenicos()).isNull();
        assertThat(m.suplementosSensiveisPulados()).isEqualTo(1);
        assertThat(m.partesPuladas()).extracting(PartePulada::parte).contains("MEDICACAO_E_ERGOGENICOS");
    }

    @Test
    void respostaDoTreinadorClassificaOSuplemento() {
        RespostasDaPlanilha r = new RespostasDaPlanilha(List.of(), List.of(), List.of(), List.of(),
                List.of(new SuplementoClassificado("creatina (5g)", "SUPLEMENTO")));
        ConteudoDieta dieta = planosDaLinha(montar(contexto(TODAS, null, List.of(), List.of(), List.of()), r), 2).dieta();
        assertThat(dieta.suplementacao()).extracting(ConteudoDieta.Suplemento::nome).containsExactly("Creatina");
        assertThat(dieta.ergogenicos()).extracting(ConteudoDieta.Ergogenico::nome).containsExactly("Remédio Fictício XYZ");
    }

    @Test
    void limiteDoPlanoBarraOsAlunosAtivosQueSobram() {
        Montagem m = montar(contexto(TODAS, 2L, List.of(), List.of(), List.of()), RespostasDaPlanilha.VAZIAS);
        assertThat(m.alunosNovos()).hasSize(2);
        assertThat(m.problemas()).filteredOn(p -> "LIMITE_DO_PLANO".equals(p.tipo())).hasSize(3);
    }

    @Test
    void alunoQueJaExisteEReaproveitadoEOPesoDoMesmoDiaNaoEGravado() {
        UUID existente = UUID.randomUUID();
        AlunoExistente um = new AlunoExistente(existente, "Outro nome fictício", "UM@example.com", false,
                Set.of(LocalDate.of(2026, 1, 5)));
        Montagem m = montar(contexto(TODAS, null, List.of(), List.of(um), List.of()), RespostasDaPlanilha.VAZIAS);
        assertThat(m.alunosNovos()).hasSize(4);
        assertThat(m.alunosReaproveitados()).isEqualTo(1);
        assertThat(m.pesosJaRegistrados()).isEqualTo(1);
        assertThat(m.pesos()).hasSize(1);
        assertThat(m.pesos().getFirst().dono().existente()).isEqualTo(existente);
        assertThat(m.planos()).anyMatch(p -> existente.equals(p.dono().existente()) && p.treino() != null);
    }

    @Test
    void exercicioDaBibliotecaLigaEOCriarEntraNaLista() {
        UUID supino = UUID.randomUUID();
        List<ExercicioDaBiblioteca> biblioteca = List.of(new ExercicioDaBiblioteca(supino, "Supino reto c/ hal.", "LIVRE",
                "https://youtu.be/sup"));
        RespostasDaPlanilha r = new RespostasDaPlanilha(List.of(), List.of(),
                List.of(new NomeResolvido("Xyzzy qwerty", "CRIAR", null)), List.of(), List.of());
        Montagem m = montar(contexto(TODAS, null, List.of(), List.of(), biblioteca), r);
        assertThat(m.exerciciosNovos()).extracting(MontagemDaImportacao.ExercicioNovo::nome).contains("Xyzzy qwerty");
        ConteudoTreino.ExercicioPlano ex = planosDaLinha(m, 2).treino().sessoes().get(1).exercicios().stream()
                .filter(e -> e.nome().startsWith("Supino")).findFirst().orElseThrow();
        assertThat(ex.exercicioId()).isEqualTo(supino);
        assertThat(ex.modalidade()).isEqualTo("LIVRE");
        assertThat(ex.videoUrl()).isEqualTo("https://youtu.be/sup");
    }

    @Test
    void abaIgnoradaNaoEntra() {
        // Aba 6 = Treinos_Exercicios.
        RespostasDaPlanilha r = new RespostasDaPlanilha(List.of(new RespostasDaPlanilha.TipoDaAba(6, "IGNORAR")), List.of(),
                List.of(), List.of(), List.of());
        Montagem m = montar(contexto(TODAS, null, List.of(), List.of(), List.of()), r);
        assertThat(m.planos()).allMatch(p -> p.treino() == null);
    }

    @Test
    void nomeDeSuplementoEDiaDaSemanaComoNoScript() {
        assertThat(MontagemDaImportacao.nomeDeSuplemento("Creatina (5g) - 5 g")).isEqualTo("creatina");
        assertThat(MontagemDaImportacao.nomeDeSuplemento("Ômega 3 1000mg")).isEqualTo("omega 3");
        assertThat(List.of("Segunda - Costas", "Sábado - Pernas", "Terça-feira", "Dia 1 - Upper", "Segundas").stream()
                .map(MontagemDaImportacao::diaDaSemana).toList())
                .isEqualTo(java.util.Arrays.asList(1, 6, 2, null, null));
        assertThat(MontagemDaImportacao.parecido("creatina", "creatina monohidratada")).isTrue();
        assertThat(MontagemDaImportacao.parecido("whey", "creatina")).isFalse();
        assertThat(Map.of()).isEmpty();
    }
}
