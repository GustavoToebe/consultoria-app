package br.com.treinos.api.importacao;

import br.com.treinos.api.importacao.ImportacaoDtos.Sugestao;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Sugestão de coluna e detecção do cabeçalho: regra pura, só títulos fictícios. */
class SugestaoDeColunasTest {

    private static Linha linha(int numero, String... textos) {
        List<Celula> celulas = new ArrayList<>();
        for (String t : textos) {
            celulas.add(Celula.deTextoLido(t));
        }
        return new Linha(numero, celulas);
    }

    private static Sugestao de(List<Sugestao> s, String campo) {
        return s.stream().filter(x -> x.campo().equals(campo)).findFirst().orElse(null);
    }

    @Test
    void sugereExataSinonimoEParecidaUmaVezPorCampoEPorColuna() {
        List<Sugestao> s = SugestaoDeColunas.sugerir("alunos",
                List.of("Nome do aluno", "E-mail", "Telefone 1 (com DDD)", "CPF", "Telefne", "Obs", "Coluna sem nada"));
        assertThat(de(s, "nome")).isEqualTo(new Sugestao("nome", 0, "SINONIMO"));
        assertThat(de(s, "email")).isEqualTo(new Sugestao("email", 1, "EXATA"));
        assertThat(de(s, "cpf")).isEqualTo(new Sugestao("cpf", 3, "EXATA"));
        // O sinônimo escrito por extenso vence a coluna só parecida.
        assertThat(de(s, "telefone")).isEqualTo(new Sugestao("telefone", 2, "SINONIMO"));
        assertThat(de(s, "observacoes")).isEqualTo(new Sugestao("observacoes", 5, "SINONIMO"));
        // "Telefne" sobra sem campo (telefone já tem coluna melhor); nenhuma coluna aparece duas vezes.
        assertThat(s).extracting(Sugestao::coluna).doesNotHaveDuplicates().doesNotContain(4, 6);
    }

    @Test
    void parecidaPorErroDeDigitacaoEPorPalavrasForaDeOrdem() {
        List<Sugestao> s = SugestaoDeColunas.sugerir("alunos", List.of("Telefne", "Logradro"));
        assertThat(de(s, "telefone")).isEqualTo(new Sugestao("telefone", 0, "PARECIDA"));
        assertThat(de(s, "logradouro")).isEqualTo(new Sugestao("logradouro", 1, "PARECIDA"));
        // Palavras do sinônimo "peso kg" em outra ordem também casam.
        assertThat(de(SugestaoDeColunas.sugerir("pesos", List.of("kg peso")), "peso")).isNotNull();
    }

    @Test
    void emailDoResponsavelNaoViraOEmailDoAluno() {
        List<Sugestao> s = SugestaoDeColunas.sugerir("alunos", List.of("E-mail", "E-mail do responsável"));
        assertThat(de(s, "email").coluna()).isZero();
        assertThat(de(s, "responsavel").coluna()).isEqualTo(1);
    }

    @Test
    void palavraSoltaNoTituloEIdadeNaoViramSinonimoNemOutroCampo() {
        // "Nome do responsável" cita o campo, mas não é o e-mail do responsável: no máximo PARECIDA.
        List<Sugestao> s = SugestaoDeColunas.sugerir("alunos", List.of("Nome", "Telefone", "Nome do responsável", "Idade"));
        assertThat(de(s, "nome")).isEqualTo(new Sugestao("nome", 0, "EXATA"));
        assertThat(de(s, "responsavel").confianca()).isEqualTo("PARECIDA");
        // "Idade" não vira "cidade" (letra inicial diferente).
        assertThat(de(s, "cidade")).isNull();
    }

    @Test
    void umaColunaPorCampoMesmoComDoisTitulosParecidos() {
        List<Sugestao> s = SugestaoDeColunas.sugerir("alunos", List.of("Nome", "Aluno"));
        assertThat(s).containsExactly(new Sugestao("nome", 0, "EXATA"));
        assertThat(SugestaoDeColunas.sugerir("inexistente", List.of("Nome"))).isEmpty();
    }

    @Test
    void detectaOCabecalhoAbaixoDeTitulosEMantemALinha1() {
        assertThat(SugestaoDeColunas.detectarCabecalho(List.of(
                linha(1, "Nome", "E-mail", "Telefone"), linha(2, "Ana Fictícia", "ana@example.com", "45999998888")), "alunos"))
                .isEqualTo(1);
        // Título e linha em branco em cima: o cabeçalho é a linha 3 do arquivo.
        assertThat(SugestaoDeColunas.detectarCabecalho(List.of(
                linha(1, "Relatório fictício de alunos"), linha(3, "Nome", "E-mail", "Telefone"),
                linha(4, "Ana Fictícia", "ana@example.com", "45999998888")), "alunos")).isEqualTo(3);
        // Sem destino (aba da planilha completa), qualquer campo conhecido conta.
        assertThat(SugestaoDeColunas.detectarCabecalho(List.of(
                linha(1, "Planilha"), linha(2, "Exercício", "Grupo Muscular", "Link Vídeo")), null)).isEqualTo(2);
    }

    @Test
    void semCabecalhoOuComTituloDesconhecidoNaoInventaLinhaDeDado() {
        // Só dados: nome, e-mail e telefone têm cara de dado ou não são nome de campo.
        assertThat(SugestaoDeColunas.detectarCabecalho(List.of(
                linha(1, "Ana Fictícia", "ana@example.com", "(45) 99999-8888"),
                linha(2, "Bia Fictícia", "bia@example.com", "(45) 99999-7777")), "alunos")).isZero();
        assertThat(SugestaoDeColunas.detectarCabecalho(List.of(), "alunos")).isZero();
        // Cabeçalho de colunas que o servidor não conhece: a primeira linha só de nomes de coluna.
        assertThat(SugestaoDeColunas.detectarCabecalho(List.of(
                linha(1, "Coluna Alfa", "Coluna Beta"), linha(2, "1", "2")), "alunos")).isEqualTo(1);
        // Títulos só de símbolo ("#", "%") continuam sendo cabeçalho; e-mail na primeira linha, não.
        assertThat(SugestaoDeColunas.detectarCabecalho(List.of(linha(1, "#", "%"), linha(2, "1", "2")), "alunos")).isEqualTo(1);
        // Uma coluna só: a primeira linha vale se ela é um campo do destino.
        assertThat(SugestaoDeColunas.detectarCabecalho(List.of(linha(1, "Nome"), linha(2, "Ana Fictícia")), "alunos")).isEqualTo(1);
    }

    @Test
    void destinoPeloCabecalhoExigeDoisCamposESemEmpate() {
        assertThat(SugestaoDeColunas.destinoPeloCabecalho(List.of(
                linha(1, "Nome", "Marca", "Categoria", "Porção", "Sabores")))).isEqualTo("suplementos");
        // Nome e categoria cabem em suplementos e em outros: empate, sem destino.
        assertThat(SugestaoDeColunas.destinoPeloCabecalho(List.of(linha(1, "Nome", "Categoria")))).isNull();
        assertThat(SugestaoDeColunas.destinoPeloCabecalho(List.of(linha(1, "Lista de compras")))).isNull();
    }
}
