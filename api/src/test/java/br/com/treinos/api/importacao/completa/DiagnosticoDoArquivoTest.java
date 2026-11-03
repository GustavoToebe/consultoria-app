package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.importacao.completa.DiagnosticoDoArquivo.Coluna;
import br.com.treinos.api.importacao.completa.DiagnosticoDoArquivo.DaAba;
import br.com.treinos.api.importacao.completa.DiagnosticoDoArquivo.Diagnostico;
import br.com.treinos.api.importacao.completa.DiagnosticoDoArquivo.Problema;
import br.com.treinos.api.importacao.completa.DiagnosticoDoArquivo.TipoDoArquivo;
import br.com.treinos.api.importacao.completa.DiagnosticoDoArquivo.Vagas;
import br.com.treinos.api.importacao.completa.LeituraDasAbas.AbaLida;
import br.com.treinos.api.importacao.completa.LeituraDasAbas.Leitura;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linha;
import static br.com.treinos.api.importacao.completa.PlanilhaDeTeste.linhas;
import static org.assertj.core.api.Assertions.assertThat;

/** Diagnóstico do arquivo: regra pura sobre abas lidas, só com dados fictícios. */
class DiagnosticoDoArquivoTest {

    private static final Vagas SEM_LIMITE = new Vagas(null, null);
    private static final List<Object> CAB = linha("Nome", "Email", "Telefone", "Data Início", "Plano Antigo");

    private static Leitura leitura(Map<String, List<List<Object>>> abas) {
        List<AbaLida> lidas = new ArrayList<>();
        for (Map.Entry<String, List<List<Object>>> e : abas.entrySet()) {
            lidas.add(new AbaLida(lidas.size(), e.getKey(), linhas(e.getValue())));
        }
        return new Leitura(lidas, false);
    }

    private static Leitura umaAba(String nome, List<List<Object>> linhas) {
        Map<String, List<List<Object>>> abas = new LinkedHashMap<>();
        abas.put(nome, linhas);
        return leitura(abas);
    }

    private static int quantidade(List<Problema> problemas, String codigo) {
        return problemas.stream().filter(p -> p.codigo().equals(codigo)).mapToInt(Problema::quantidade).sum();
    }

    @Test
    void planilhaCompletaDoTreinadorEReconhecidaPorAba() {
        Diagnostico d = DiagnosticoDoArquivo.diagnosticar(leitura(PlanilhaDeTeste.abasDoTreinador()), SEM_LIMITE);

        assertThat(d.tipo()).isEqualTo(TipoDoArquivo.PLANILHA_COMPLETA);
        assertThat(d.abas()).hasSize(9);
        assertThat(d.abas().get(0).tipo()).isEqualTo(TipoDeAba.ALUNOS);
        assertThat(d.abas().get(8).tipo()).isEqualTo(TipoDeAba.TABELA_DE_ALIMENTOS);
        assertThat(quantidade(d.problemas(), "ABA_SEM_USO")).isEqualTo(1);
        assertThat(quantidade(d.problemas(), "EMAIL_INVALIDO")).isEqualTo(1);
        DaAba alunos = d.abas().get(0);
        assertThat(alunos.linhas()).isEqualTo(5);
        assertThat(alunos.colunas()).extracting(Coluna::nome).contains("Nome", "Email", "Telefone");
        assertThat(alunos.colunas()).filteredOn(c -> "EMAIL".equals(c.campo())).extracting(Coluna::letra).containsExactly("C");
    }

    @Test
    void cadastroDeAlunosContaProblemasSemRepetirValor() {
        Diagnostico d = DiagnosticoDoArquivo.diagnosticar(umaAba("Alunos", List.of(CAB,
                linha("Aluno Teste 1", "um@example.com", "(45) 99999-8888", "05/01/2026", "Gold"),
                linha("Aluno Teste 2", "UM@example.com", null, "31/02/2026", "Silver"),
                linha(null, "sem-arroba", null, "texto", null),
                linha("Aluno Teste 4", null, null, null, null),
                linha(null, null, null, null, null),
                linha("Aluno Teste 5", "x", null, PlanilhaDeTeste.data("2026-01-05"), null))), SEM_LIMITE);

        assertThat(d.tipo()).isEqualTo(TipoDoArquivo.CADASTRO_DE_ALUNOS);
        DaAba a = d.abas().getFirst();
        assertThat(a.linhas()).isEqualTo(5);
        assertThat(a.linhasVazias()).isEqualTo(1);
        assertThat(a.linhasSemNome()).isEqualTo(1);
        assertThat(a.emailsInvalidos()).isEqualTo(1);
        assertThat(a.emailsDuplicados()).isEqualTo(1);
        assertThat(a.datasInvalidas()).isEqualTo(2);
        assertThat(quantidade(a.problemas(), "COLUNA_NAO_RECONHECIDA")).isEqualTo(1);
        assertThat(a.colunas()).filteredOn(c -> c.campo() == null).extracting(Coluna::nome).containsExactly("Plano Antigo");
        assertThat(d.problemas()).extracting(Problema::codigo).contains("LINHA_SEM_NOME", "EMAIL_INVALIDO",
                "EMAIL_DUPLICADO", "DATA_INVALIDA", "COLUNA_NAO_RECONHECIDA");
        assertThat(d.toString()).doesNotContain("Aluno Teste").doesNotContain("example.com").doesNotContain("sem-arroba");
    }

    @Test
    void celulaComErroDeFormulaEContadaSemOTexto() {
        Leitura lida = LeituraDasAbas.ler("erro.xlsx", PlanilhaDeTeste.xlsx(Map.of("Alunos", List.of(CAB,
                linha("Aluno Teste 1", new PlanilhaDeTeste.Erro("#REF!"), null, null, null),
                linha("Aluno Teste 2", "dois@example.com", null, null, null)))));

        Diagnostico d = DiagnosticoDoArquivo.diagnosticar(lida, SEM_LIMITE);

        assertThat(d.abas().getFirst().celulasComErro()).isEqualTo(1);
        assertThat(quantidade(d.problemas(), "CELULA_COM_ERRO_DE_FORMULA")).isEqualTo(1);
        assertThat(d.toString()).doesNotContain("#REF!");
    }

    @Test
    void limiteDoPlanoEDoImportadorSaoSoContagem() {
        Leitura cinco = umaAba("Alunos", List.of(CAB,
                linha("Aluno Teste 1", null, null, null, null), linha("Aluno Teste 2", null, null, null, null),
                linha("Aluno Teste 3", null, null, null, null), linha("Aluno Teste 4", null, null, null, null),
                linha("Aluno Teste 5", null, null, null, null), linha(null, "a@example.com", null, null, null)));

        Diagnostico estourado = DiagnosticoDoArquivo.diagnosticar(cinco, new Vagas(3L, -2L));
        assertThat(quantidade(estourado.problemas(), "ACIMA_DO_LIMITE_DO_PLANO")).isEqualTo(2);
        assertThat(quantidade(estourado.problemas(), "ACIMA_DO_LIMITE_DO_TREINADOR")).isEqualTo(5); // negativo conta como zero

        Diagnostico cabe = DiagnosticoDoArquivo.diagnosticar(cinco, new Vagas(5L, null));
        assertThat(cabe.problemas()).extracting(Problema::codigo)
                .doesNotContain("ACIMA_DO_LIMITE_DO_PLANO", "ACIMA_DO_LIMITE_DO_TREINADOR");
    }

    @Test
    void semCabecalhoNenhumaPrimeiraLinhaDeDadosViraNomeDeColuna() {
        String sentinela = "Sentinela-Unica-Zq7";
        Diagnostico d = DiagnosticoDoArquivo.diagnosticar(umaAba("Planilha", List.of(
                linha("Aluno Teste 1", sentinela, null),
                linha("Aluno Teste 2", "Outra Cidade", null))), SEM_LIMITE);

        assertThat(d.abas().getFirst().colunas()).allSatisfy(c -> assertThat(c.nome()).isNull());
        assertThat(d.toString()).doesNotContain(sentinela).doesNotContain("Aluno Teste");
    }

    @Test
    void tipoDoArquivoPorFamiliaDeAbas() {
        Map<String, List<List<Object>>> todas = PlanilhaDeTeste.abasDoTreinador();
        assertThat(DiagnosticoDoArquivo.diagnosticar(leitura(Map.of("Treinos_Exercicios", todas.get("Treinos_Exercicios"))),
                SEM_LIMITE).tipo()).isEqualTo(TipoDoArquivo.TREINO);
        assertThat(DiagnosticoDoArquivo.diagnosticar(leitura(Map.of("Refeições", todas.get("Refeições"))), SEM_LIMITE).tipo())
                .isEqualTo(TipoDoArquivo.DIETA);
        assertThat(DiagnosticoDoArquivo.diagnosticar(leitura(Map.of("Lista_Exercicios", todas.get("Lista_Exercicios"))),
                SEM_LIMITE).tipo()).isEqualTo(TipoDoArquivo.OUTRO);
        Diagnostico estranho = DiagnosticoDoArquivo.diagnosticar(umaAba("Qualquer", List.of(
                linha("Alfa", "Beta"), linha("a", "b"), linha("c", "d"))), SEM_LIMITE);
        assertThat(estranho.tipo()).isEqualTo(TipoDoArquivo.DESCONHECIDO);
        assertThat(quantidade(estranho.problemas(), "ABA_NAO_RECONHECIDA")).isEqualTo(1);
    }

    @Test
    void arquivoSemLinhasDeDados() {
        Diagnostico d = DiagnosticoDoArquivo.diagnosticar(umaAba("Alunos", List.of(CAB)), SEM_LIMITE);
        assertThat(d.linhas()).isZero();
        assertThat(quantidade(d.problemas(), "ARQUIVO_SEM_DADOS")).isEqualTo(1);
        assertThat(quantidade(d.problemas(), "ABA_SEM_DADOS")).isEqualTo(1);
    }
}
