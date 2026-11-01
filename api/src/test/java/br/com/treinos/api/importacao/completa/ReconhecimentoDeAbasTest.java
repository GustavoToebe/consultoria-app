package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas.Aviso;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas.Reconhecimento;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.data;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linha;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linhas;
import static org.assertj.core.api.Assertions.assertThat;

/** Reconhecimento das abas por regras fixas, só com dados fictícios. */
class ReconhecimentoDeAbasTest {

    private static Reconhecimento reconhecer(List<List<Object>> abas) {
        return ReconhecimentoDeAbas.reconhecer(linhas(abas));
    }

    @Test
    void reconheceAsAbasDaPlanilhaDoTreinador() {
        Map<String, List<List<Object>>> abas = PlanilhaDeTeste.abasDoTreinador();
        Map<String, TipoDeAba> esperado = Map.of(
                "Alunos", TipoDeAba.ALUNOS, "Histórico Pesos", TipoDeAba.PESOS, "Planos", TipoDeAba.PLANOS_DE_DIETA,
                "Refeições", TipoDeAba.DIETA, "Suplementos", TipoDeAba.SUPLEMENTOS, "Treinos_Rotinas", TipoDeAba.ROTINAS,
                "Treinos_Exercicios", TipoDeAba.TREINO, "Lista_Exercicios", TipoDeAba.LISTA_DE_EXERCICIOS,
                "TACO", TipoDeAba.TABELA_DE_ALIMENTOS);
        esperado.forEach((nome, tipo) -> assertThat(reconhecer(abas.get(nome)).tipo()).as(nome).isEqualTo(tipo));

        Reconhecimento alunos = reconhecer(abas.get("Alunos"));
        assertThat(alunos.linhaDoCabecalho()).isEqualTo(1);
        assertThat(alunos.campos()).containsEntry(Campo.CODIGO, 0).containsEntry(Campo.ALUNO, 1)
                .containsEntry(Campo.EMAIL, 2).containsEntry(Campo.TELEFONE, 3).containsEntry(Campo.PESO_INICIAL, 4)
                .containsEntry(Campo.OBJETIVO, 5).containsEntry(Campo.DATA_INICIO, 6).containsEntry(Campo.STATUS, 7)
                .containsEntry(Campo.OBSERVACAO, 8);
        assertThat(alunos.avisos()).isEmpty();

        Reconhecimento pesos = reconhecer(abas.get("Histórico Pesos"));
        assertThat(pesos.campos()).containsEntry(Campo.CODIGO, 0).containsEntry(Campo.ALUNO_CODIGO, 1)
                .containsEntry(Campo.ALUNO, 2).containsEntry(Campo.DATA, 3).containsEntry(Campo.SEMANA, 4)
                .containsEntry(Campo.PESO, 5).containsEntry(Campo.VARIACAO, 6).containsEntry(Campo.OBSERVACAO, 7);

        Reconhecimento exercicios = reconhecer(abas.get("Treinos_Exercicios"));
        assertThat(exercicios.campos()).containsEntry(Campo.CODIGO, 0).containsEntry(Campo.ROTINA_CODIGO, 1)
                .containsEntry(Campo.LETRA_TREINO, 2).containsEntry(Campo.NOME_TREINO, 3).containsEntry(Campo.ORDEM, 5)
                .containsEntry(Campo.EXERCICIO, 6).containsEntry(Campo.SERIES_TRABALHO, 7)
                .containsEntry(Campo.SERIES_PREPARACAO, 8).containsEntry(Campo.TOP_SET, 9).containsEntry(Campo.BACK_OFF, 10)
                .containsEntry(Campo.REPETICOES, 11).containsEntry(Campo.OBSERVACAO, 12).containsEntry(Campo.VIDEO, 13)
                .containsEntry(Campo.BACK_OFF_PERCENTUAL, 14);

        Reconhecimento refeicoes = reconhecer(abas.get("Refeições"));
        assertThat(refeicoes.campos()).containsEntry(Campo.PLANO_CODIGO, 1).containsEntry(Campo.REFEICAO, 2)
                .containsEntry(Campo.TITULO, 3).containsEntry(Campo.OPCAO, 4).containsEntry(Campo.ORDEM, 5)
                .containsEntry(Campo.ALIMENTO, 6).containsEntry(Campo.QUANTIDADE, 7).containsEntry(Campo.KCAL, 8)
                .containsEntry(Campo.PROTEINA, 9).containsEntry(Campo.CARBOIDRATO, 10).containsEntry(Campo.GORDURA, 11)
                .containsEntry(Campo.UNIDADE, 13);
        assertThat(refeicoes.campos()).doesNotContainValue(14); // "Peso Unidade (g)": a unidade já tinha coluna

        Reconhecimento planos = reconhecer(abas.get("Planos"));
        assertThat(planos.campos()).containsEntry(Campo.PLANO_CODIGO, 0).containsEntry(Campo.ALUNO_CODIGO, 1)
                .containsEntry(Campo.ORIENTACAO, 3).containsEntry(Campo.ATIVO, 8);
        assertThat(reconhecer(abas.get("Suplementos")).campos()).containsEntry(Campo.SUPLEMENTO, 3)
                .containsEntry(Campo.DOSE, 4).containsEntry(Campo.HORARIO, 5);
    }

    @Test
    void tituloAcimaDoCabecalhoECodigoNoLugarDoTituloID() {
        // Como o teste "primeira célula do cabeçalho com um ID no lugar de ID, título acima" do planilha.test.mjs.
        Reconhecimento alunos = reconhecer(List.of(linha("Cadastro (fictício)"), linha(),
                linha("ALU000", "Nome", "Email", "Status"), linha("ALU010", "Aluno Teste 10", null, "Pausado")));
        assertThat(alunos.tipo()).isEqualTo(TipoDeAba.ALUNOS);
        assertThat(alunos.linhaDoCabecalho()).isEqualTo(3);
        assertThat(alunos.posicaoDoCabecalho()).isEqualTo(2);
        assertThat(alunos.campos()).containsEntry(Campo.CODIGO, 0).containsEntry(Campo.ALUNO, 1).containsEntry(Campo.EMAIL, 2);
        assertThat(alunos.avisos()).containsExactly(new Aviso("TITULO_COM_CARA_DE_DADO", 3, 0));

        Reconhecimento pesos = reconhecer(List.of(linha("ALU000", "ID Aluno", "Data", "Peso (kg)"),
                linha("P1", "ALU010", data("2026-05-01"), 70)));
        assertThat(pesos.tipo()).isEqualTo(TipoDeAba.PESOS);
        assertThat(pesos.campos()).containsEntry(Campo.CODIGO, 0).containsEntry(Campo.ALUNO_CODIGO, 1);
    }

    @Test
    void dadoAcimaDoCabecalhoViraAviso() {
        Reconhecimento r = reconhecer(List.of(linha("Relatório", "fulano@exemplo.com"), linha("Nome", "E-mail", "WhatsApp"),
                linha("Aluno Teste", "teste@exemplo.com", "(45) 99999-0001")));
        assertThat(r.linhaDoCabecalho()).isEqualTo(2);
        assertThat(r.tipo()).isEqualTo(TipoDeAba.ALUNOS);
        assertThat(r.avisos()).containsExactly(new Aviso("DADO_ACIMA_DO_CABECALHO", 1, 1));
    }

    @Test
    void outrosFormatosDePlanilhaPelosSinonimos() {
        assertThat(reconhecer(List.of(linha("Aluno", "Whats", "E-mail")))).extracting(Reconhecimento::tipo)
                .isEqualTo(TipoDeAba.ALUNOS);
        Reconhecimento treino = reconhecer(List.of(linha("Exercício", "Séries", "Reps", "Carga (kg)", "Descanso")));
        assertThat(treino.tipo()).isEqualTo(TipoDeAba.TREINO);
        assertThat(treino.campos()).containsEntry(Campo.EXERCICIO, 0).containsEntry(Campo.SERIES, 1)
                .containsEntry(Campo.REPETICOES, 2).containsEntry(Campo.CARGA, 3).containsEntry(Campo.DESCANSO, 4);
        assertThat(reconhecer(List.of(linha("Exercício", "Séries x Reps"))).campos()).containsEntry(Campo.PRESCRICAO, 1);
        Reconhecimento dieta = reconhecer(List.of(linha("Refeição", "Alimento", "Qtd (g)", "Kcal")));
        assertThat(dieta.tipo()).isEqualTo(TipoDeAba.DIETA);
        assertThat(dieta.campos()).containsEntry(Campo.QUANTIDADE, 2);
        assertThat(reconhecer(List.of(linha("Suplemento", "Dose", "Horário"))).tipo()).isEqualTo(TipoDeAba.SUPLEMENTOS);
        assertThat(reconhecer(List.of(linha("Medicamento", "Posologia"))).tipo()).isEqualTo(TipoDeAba.SUPLEMENTOS);
        assertThat(reconhecer(List.of(linha("Exercício", "Grupo muscular", "Link"))).tipo())
                .isEqualTo(TipoDeAba.LISTA_DE_EXERCICIOS);
        assertThat(reconhecer(List.of(linha("Cliente", "Data", "Kg"))).tipo()).isEqualTo(TipoDeAba.PESOS);
        assertThat(reconhecer(List.of(linha("Coisa", "Outra coisa"), linha("a", "b"))).tipo()).isEqualTo(TipoDeAba.DESCONHECIDA);
        assertThat(reconhecer(List.of()).tipo()).isEqualTo(TipoDeAba.DESCONHECIDA);
    }

    @Test
    void semCabecalhoPeloFormatoDoConteudo() {
        Reconhecimento alunos = reconhecer(List.of(
                linha("Aluna Teste Um", "um@exemplo.com", "(45) 99999-0001"),
                linha("Aluno Teste Dois", "dois@exemplo.com", "45999990002")));
        assertThat(alunos.linhaDoCabecalho()).isZero();
        assertThat(alunos.posicaoDoCabecalho()).isEqualTo(-1);
        assertThat(alunos.tipo()).isEqualTo(TipoDeAba.ALUNOS);
        assertThat(alunos.campos()).containsEntry(Campo.ALUNO, 0).containsEntry(Campo.EMAIL, 1).containsEntry(Campo.TELEFONE, 2);

        Reconhecimento treino = reconhecer(List.of(linha("Supino fictício", "4x10"), linha("Remada fictícia", "3x8-12")));
        assertThat(treino.tipo()).isEqualTo(TipoDeAba.TREINO);
        assertThat(treino.campos()).containsEntry(Campo.EXERCICIO, 0).containsEntry(Campo.PRESCRICAO, 1);

        Reconhecimento pesos = reconhecer(List.of(linha("Aluno Teste", data("2026-01-05"), 80.5),
                linha("Aluno Teste", data("2026-01-12"), 79.9)));
        assertThat(pesos.tipo()).isEqualTo(TipoDeAba.PESOS);
        assertThat(pesos.campos()).containsEntry(Campo.ALUNO, 0).containsEntry(Campo.DATA, 1).containsEntry(Campo.PESO, 2);
    }

    @Test
    void colunaSemNomeConhecidoGanhaOCampoPeloConteudo() {
        Reconhecimento r = reconhecer(List.of(linha("Nome", "Endereço digital"),
                linha("Aluno Teste", "teste@exemplo.com"), linha("Aluna Teste", "outra@exemplo.com")));
        assertThat(r.campos()).containsEntry(Campo.ALUNO, 0).containsEntry(Campo.EMAIL, 1);
        assertThat(r.tipo()).isEqualTo(TipoDeAba.ALUNOS);
    }

    @Test
    void campoDoNomeDaColuna() {
        Map<String, Campo> casos = Map.ofEntries(
                Map.entry("ID", Campo.CODIGO), Map.entry("Código do aluno", Campo.ALUNO_CODIGO),
                Map.entry("Aluno ID", Campo.ALUNO_CODIGO), Map.entry("Cód. Plano", Campo.PLANO_CODIGO),
                Map.entry("ID Treino", Campo.ROTINA_CODIGO), Map.entry("ID Exerc", Campo.CODIGO),
                Map.entry("WhatsApp", Campo.TELEFONE), Map.entry("Celular", Campo.TELEFONE),
                Map.entry("E-MAIL", Campo.EMAIL), Map.entry("Nome do aluno", Campo.ALUNO),
                Map.entry("Nome do Alimento", Campo.ALIMENTO), Map.entry("Repetições", Campo.REPETICOES),
                Map.entry("Rep Range", Campo.REPETICOES), Map.entry("Séries/Reps", Campo.PRESCRICAO),
                Map.entry("Quantidade (g)", Campo.QUANTIDADE), Map.entry("Peso (kg)", Campo.PESO),
                Map.entry("Peso Inicial (kg)", Campo.PESO_INICIAL), Map.entry("Variação (kg)", Campo.VARIACAO),
                Map.entry("Grupo Muscular", Campo.GRUPO_MUSCULAR), Map.entry("Link Vídeo", Campo.VIDEO),
                Map.entry("Horário", Campo.HORARIO), Map.entry("Refeição Livre", Campo.ORIENTACAO),
                Map.entry("Nº Refeição", Campo.REFEICAO), Map.entry("Intra-treino", Campo.ORIENTACAO));
        casos.forEach((nome, campo) -> assertThat(ReconhecimentoDeAbas.campoDoNome(nome)).as(nome).contains(campo));
        assertThat(ReconhecimentoDeAbas.campoDoNome("Modelo Base")).isEqualTo(Optional.empty());
        assertThat(ReconhecimentoDeAbas.campoDoNome("  ")).isEmpty();
    }
}
