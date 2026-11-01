package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import br.com.treinos.api.importacao.completa.LigacaoDeAbas.AbaReconhecida;
import br.com.treinos.api.importacao.completa.LigacaoDeAbas.Ligacao;
import br.com.treinos.api.importacao.completa.LigacaoDeAbas.Por;
import br.com.treinos.api.importacao.completa.ReconhecimentoDeAbas.Reconhecimento;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.data;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linha;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linhas;
import static org.assertj.core.api.Assertions.assertThat;

/** Ligação entre abas, só com dados fictícios. */
class LigacaoDeAbasTest {

    private static AbaReconhecida aba(int indice, String nome, List<List<Object>> conteudo) {
        List<Linha> lidas = linhas(conteudo);
        Reconhecimento r = ReconhecimentoDeAbas.reconhecer(lidas);
        return new AbaReconhecida(indice, nome, r, lidas.subList(r.posicaoDoCabecalho() + 1, lidas.size()));
    }

    private static List<AbaReconhecida> abasDoTreinador() {
        List<AbaReconhecida> abas = new ArrayList<>();
        int i = 0;
        for (Map.Entry<String, List<List<Object>>> e : PlanilhaDeTeste.abasDoTreinador().entrySet()) {
            abas.add(aba(i++, e.getKey(), e.getValue()));
        }
        return abas;
    }

    @Test
    void ligaAsAbasDaPlanilhaDoTreinadorPelosCodigos() {
        List<AbaReconhecida> abas = abasDoTreinador();
        List<Ligacao> ligacoes = LigacaoDeAbas.ligarTodas(abas);
        // Pesos (1), Planos (2), Refeições (3), Suplementos (4), Rotinas (5) e Exercícios (6).
        assertThat(ligacoes).extracting(Ligacao::filha).containsExactly(1, 2, 3, 4, 5, 6);
        Ligacao pesos = ligacoes.getFirst();
        assertThat(pesos.mae()).isZero();
        assertThat(pesos.colunaFilha()).isEqualTo(1);
        assertThat(pesos.colunaMae()).isZero();
        assertThat(pesos.por()).isEqualTo(Por.CODIGO);
        assertThat(pesos.ligadas()).containsExactly(2, 3, 4, 5, 6);
        assertThat(pesos.naoLigadas()).containsExactly(7); // AL9 não está em Alunos
        assertThat(pesos.ambiguas()).isEmpty();

        Ligacao refeicoes = ligacoes.get(2);
        assertThat(refeicoes.mae()).isEqualTo(2); // Planos
        assertThat(refeicoes.naoLigadas()).isEmpty();
        Ligacao exercicios = ligacoes.get(5);
        assertThat(exercicios.mae()).isEqualTo(5); // Rotinas
        assertThat(exercicios.naoLigadas()).containsExactly(8); // R9 não existe
    }

    @Test
    void descobreAColunaChaveDaMaePeloConteudo() {
        // O código do aluno está na terceira coluna de Alunos, com um título que nenhuma regra conhece.
        AbaReconhecida alunos = aba(0, "Cadastro", List.of(linha("Nome", "E-mail", "Matr"),
                linha("Aluno Um", "um@exemplo.com", "M-01"), linha("Aluno Dois", "dois@exemplo.com", "M-02")));
        AbaReconhecida pesos = aba(1, "Pesos", List.of(linha("ID Aluno", "Data", "Peso"),
                linha("m-01", data("2026-01-01"), 80), linha(" M-02 ", data("2026-01-02"), 70), linha("M-03", data("2026-01-03"), 60)));
        assertThat(alunos.tipo()).isEqualTo(TipoDeAba.ALUNOS);
        assertThat(pesos.tipo()).isEqualTo(TipoDeAba.PESOS);
        Ligacao l = LigacaoDeAbas.ligarTodas(List.of(alunos, pesos)).getFirst();
        assertThat(l.colunaMae()).isEqualTo(2);
        assertThat(l.ligadas()).containsExactly(2, 3);
        assertThat(l.naoLigadas()).containsExactly(4);

        assertThat(LigacaoDeAbas.colunaChave(alunos.dados(), List.of("x-1", "x-2"), -1)).isEmpty();
        assertThat(LigacaoDeAbas.colunaChave(alunos.dados(), List.of(), -1)).isEmpty();
    }

    @Test
    void semCodigoLigaPeloNomeEOAmbiguoViraPergunta() {
        AbaReconhecida alunos = aba(0, "Alunos", List.of(linha("Nome", "Telefone"),
                linha("Aluno Teste", "(45) 99999-0001"), linha("Outro Aluno", "(45) 99999-0002"),
                linha("Outro  aluno", "(45) 99999-0003"), linha("Ana Fictícia", null)));
        AbaReconhecida pesos = aba(1, "Pesos", List.of(linha("Aluno", "Data", "Peso (kg)"),
                linha("ALUNO TESTE", data("2026-01-01"), 80), linha("Outro Aluno", data("2026-01-01"), 70),
                linha("ana ficticia", data("2026-01-01"), 60), linha("Quem Não Existe", data("2026-01-01"), 50),
                linha(null, data("2026-01-01"), 50)));
        Ligacao l = LigacaoDeAbas.ligarTodas(List.of(alunos, pesos)).getFirst();
        assertThat(l.por()).isEqualTo(Por.NOME);
        assertThat(l.ligadas()).containsExactly(2, 4);
        assertThat(l.ambiguas()).containsExactly(3);
        assertThat(l.naoLigadas()).containsExactly(5);
    }

    @Test
    void semMaeNaoHaLigacao() {
        AbaReconhecida pesos = aba(0, "Pesos", List.of(linha("ID Aluno", "Data", "Peso"), linha("A1", data("2026-01-01"), 80)));
        assertThat(LigacaoDeAbas.ligarTodas(List.of(pesos))).isEmpty();
    }
}
