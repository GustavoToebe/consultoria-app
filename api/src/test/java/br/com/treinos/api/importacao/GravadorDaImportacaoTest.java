package br.com.treinos.api.importacao;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.LimiteDoTreinador;
import br.com.treinos.api.alunos.Sexo;
import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.ErgogenicoRepository;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.conta.PlanoDaConsultoria;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.ImportacaoDtos.Erro;
import br.com.treinos.api.importacao.LeitorDePlanilha.Celula;
import br.com.treinos.api.importacao.LeitorDePlanilha.Linha;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Gravador da importação de alunos sem banco (repositórios de mentira): responsável por nome, nascimento, sexo e efeitos. Dados fictícios. */
class GravadorDaImportacaoTest {

    private static final Map<String, Integer> COLUNAS = Map.of("nome", 0, "email", 1, "responsavel", 2, "situacao", 3,
            "nascimento", 4, "sexo", 5);

    private final AlunoRepository alunos = mock(AlunoRepository.class);
    private final AlunoService alunoService = mock(AlunoService.class);
    private final UsuarioRepository usuarios = mock(UsuarioRepository.class);
    private final PlanoDaConsultoria plano = mock(PlanoDaConsultoria.class);
    private final EntityManager entityManager = mock(EntityManager.class);
    private final LimiteDoTreinador limite = mock(LimiteDoTreinador.class);
    private final GravadorDaImportacao gravador = new GravadorDaImportacao(alunos, alunoService, usuarios, plano,
            mock(RegistroPesoRepository.class), mock(ExercicioRepository.class), mock(AlimentoRepository.class),
            mock(ErgogenicoRepository.class), null, null, limite, entityManager);

    private static Usuario membro(String email, String nome) {
        Usuario u = Usuario.treinador(null, email, nome, "hash-ficticio");
        ReflectionTestUtils.setField(u, "id", UUID.randomUUID());
        return u;
    }

    private static LeitorDePlanilha.Planilha planilha(List<List<String>> dados) {
        List<Linha> linhas = new ArrayList<>();
        linhas.add(linha(1, List.of("Nome", "E-mail", "Responsável", "Situação", "Nascimento", "Sexo")));
        for (List<String> d : dados) {
            linhas.add(linha(linhas.size() + 1, d));
        }
        return new LeitorDePlanilha.Planilha(List.of("Planilha"), 0, linhas, false);
    }

    private static Linha linha(int numero, List<String> textos) {
        return new Linha(numero, textos.stream().map(Celula::deTextoLido).toList());
    }

    private GravadorDaImportacao.Resultado processar(List<List<String>> dados, boolean gravar, List<Aluno> existentes,
                                                     Usuario... equipe) {
        when(alunos.findAll()).thenReturn(existentes);
        when(usuarios.findByConsultoriaIdAndPapelOrderByNomeAsc(any(), eq(Papel.TREINADOR))).thenReturn(List.of(equipe));
        when(entityManager.unwrap(Session.class)).thenReturn(mock(Session.class));
        // Sem limite (nulo); o Mockito devolveria 0 para o Long, que é "nenhuma vaga".
        when(plano.vagasDeAluno()).thenReturn(null);
        when(limite.vagas(any(), any())).thenReturn(null);
        return gravador.processar("alunos", planilha(dados), new ConfiguracaoDaImportacao(0, 1, "email", "ATUALIZAR", COLUNAS),
                UUID.randomUUID(), gravar);
    }

    @Test
    void responsavelPeloEmailOuPeloNomeDeUmUnicoMembroAtivo() {
        Usuario unico = membro("membro.zq1@example.com", "Membro Fictício");
        var r = processar(List.of(
                List.of("Aluno Zq1", "zq1@example.com", "membro ficticio", "", "", ""),
                List.of("Aluno Zq2", "zq2@example.com", "MEMBRO.ZQ1@example.com", "", "", ""),
                List.of("Aluno Zq3", "zq3@example.com", "Repetido Fictício", "", "", ""),
                List.of("Aluno Zq4", "zq4@example.com", "Ninguém Fictício", "", "", "")),
                false, List.of(), unico, membro("rep.zq1@example.com", "Repetido Fictício"),
                membro("rep.zq2@example.com", "Repetido Ficticio"));

        assertThat(r.erros()).containsExactly(
                new Erro(4, "responsavel", GravadorDaImportacao.RESPONSAVEL_NAO_ENCONTRADO),
                new Erro(5, "responsavel", GravadorDaImportacao.RESPONSAVEL_NAO_ENCONTRADO));
        assertThat(r.novos()).isEqualTo(2);
    }

    @Test
    void nascimentoESexoValidadosSemRepetirOValor() {
        LocalDate amanha = LocalDate.now(br.com.treinos.api.web.Fuso.BRASILIA).plusDays(2);
        var r = processar(List.of(
                List.of("Aluno Zq1", "zq1@example.com", "", "", "05/01/1990", "F"),
                List.of("Aluno Zq2", "zq2@example.com", "", "", "01/01/1800", ""),
                List.of("Aluno Zq3", "zq3@example.com", "", "", amanha.getDayOfMonth() + "/" + amanha.getMonthValue() + "/"
                        + amanha.getYear(), ""),
                List.of("Aluno Zq4", "zq4@example.com", "", "", "", "Talvez")),
                false, List.of());

        assertThat(r.novos()).isEqualTo(1);
        assertThat(r.erros()).extracting(Erro::linha, Erro::campo).containsExactly(
                org.assertj.core.groups.Tuple.tuple(3, "nascimento"), org.assertj.core.groups.Tuple.tuple(4, "nascimento"),
                org.assertj.core.groups.Tuple.tuple(5, "sexo"));
        assertThat(r.erros()).extracting(Erro::motivo).noneMatch(m -> m.contains("1800") || m.contains("Talvez"));
        assertThat(r.erros().get(2).motivo()).isEqualTo(GravadorDaImportacao.SEXO_INVALIDO);
    }

    @Test
    void sexoDaPlanilhaViraOEnumSemChutar() {
        assertThat(GravadorDaImportacao.sexo("M")).isEqualTo(Sexo.MASCULINO);
        assertThat(GravadorDaImportacao.sexo("Masc.")).isEqualTo(Sexo.MASCULINO);
        assertThat(GravadorDaImportacao.sexo(" homem ")).isEqualTo(Sexo.MASCULINO);
        assertThat(GravadorDaImportacao.sexo("f")).isEqualTo(Sexo.FEMININO);
        assertThat(GravadorDaImportacao.sexo("FEMININO")).isEqualTo(Sexo.FEMININO);
        assertThat(GravadorDaImportacao.sexo("Mulher")).isEqualTo(Sexo.FEMININO);
        assertThat(GravadorDaImportacao.sexo("Outro")).isEqualTo(Sexo.OUTRO);
        assertThat(GravadorDaImportacao.sexo("o")).isNull();
        assertThat(GravadorDaImportacao.sexo("Sim")).isNull();
    }

    @Test
    void inativarSoDepoisDoFlushEUmaConferenciaDeVaga() {
        Aluno existente = new Aluno("Aluno Zq1", "zq1@example.com", null, null, null);
        processar(List.of(
                List.of("Aluno Zq1", "zq1@example.com", "", "inativo", "05/01/1990", "Feminino"),
                List.of("Aluno Zq2", "zq2@example.com", "", "ativo", "", ""),
                List.of("Aluno Zq3", "zq3@example.com", "", "ativo", "", "")),
                true, List.of(existente));

        InOrder ordem = inOrder(alunos, alunoService);
        ordem.verify(alunos).flush();
        ordem.verify(alunoService).aplicarSituacaoDaImportacao(existente, false);
        verify(plano, times(1)).exigirVagaDeAluno();
        verify(alunoService).definirSexo(existente, "FEMININO");
        assertThat(existente.getDataNascimento()).isEqualTo(LocalDate.of(1990, 1, 5));
    }

    @Test
    void inativarEReativarNoMesmoArquivoNaoMexeNaSituacao() {
        Aluno existente = new Aluno("Aluno Zq1", "zq1@example.com", null, null, null);
        var r = processar(List.of(
                List.of("Aluno Zq1", "zq1@example.com", "", "inativo", "", ""),
                List.of("Aluno Zq1", "zq1@example.com", "", "ativo", "", "")),
                true, List.of(existente));

        assertThat(r.atualizados()).isEqualTo(2);
        verify(alunoService, never()).aplicarSituacaoDaImportacao(any(), anyBoolean());
    }
}
