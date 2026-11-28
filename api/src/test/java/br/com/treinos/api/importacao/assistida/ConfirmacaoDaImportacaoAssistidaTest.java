package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoDetalhe;
import br.com.treinos.api.alunos.dto.AlunoDtos.AlunoRequest;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.dieta.PlanoDietaRepository;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.importacao.ImportacaoRepository;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.CadastroImportavel;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmacaoResultado;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.ConfirmarSessaoRequisicao;
import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import br.com.treinos.api.importacao.assistida.ia.ResultadoInterpretacao.OrigemDoNome;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.web.ValidacaoException;
import br.com.treinos.api.treino.PlanoTreinoRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Trava {@code MESMO_NOME_NA_SESSAO} da confirmação: só para o nome lido do conteúdo. Dados fictícios; repositórios e
 * {@link AlunoService} são mocks, nada toca banco nem rede.
 */
class ConfirmacaoDaImportacaoAssistidaTest {

    private final UUID consultoriaId = UUID.randomUUID();
    private final UUID usuarioId = UUID.randomUUID();
    private final JsonMapper json = JsonMapper.builder()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false).build();
    /** Alunos "gravados" pelo {@link AlunoService} de mentira, lidos de volta por {@code findAllById}. */
    private final Map<UUID, Aluno> criados = new HashMap<>();

    private ImportacaoSessao ultimaSessao;
    private ImportacaoSessaoRepository sessoes;
    private AlunoService alunoService;
    private ConfirmacaoDaImportacaoAssistida confirmacao;

    @BeforeEach
    void preparar() {
        TenantContext.set(consultoriaId);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("u", null,
                List.of(new SimpleGrantedAuthority("PERM_ALUNO_ALTERAR"), new SimpleGrantedAuthority("PERM_ALUNO_LER"))));
        sessoes = mock(ImportacaoSessaoRepository.class);
        alunoService = mock(AlunoService.class);
        AlunoRepository alunos = mock(AlunoRepository.class);
        when(alunoService.criar(any())).thenAnswer(inv -> {
            AlunoRequest r = inv.getArgument(0);
            Aluno a = new Aluno(r.nome(), r.email(), null, null);
            ReflectionTestUtils.setField(a, "id", UUID.randomUUID());
            criados.put(a.getId(), a);
            AlunoDetalhe d = mock(AlunoDetalhe.class);
            when(d.id()).thenReturn(a.getId());
            when(d.nome()).thenReturn(a.getNome());
            return d;
        });
        when(alunos.findAllById(any())).thenAnswer(inv -> {
            List<Aluno> achados = new ArrayList<>();
            for (Object id : (Iterable<?>) inv.getArgument(0)) {
                if (criados.containsKey(id)) {
                    achados.add(criados.get(id));
                }
            }
            return achados;
        });
        PlatformTransactionManager transacoes = mock(PlatformTransactionManager.class);
        when(transacoes.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        confirmacao = new ConfirmacaoDaImportacaoAssistida(sessoes, mock(ImportacaoArquivoRepository.class), json,
                alunoService, alunos, mock(ConsultoriaRepository.class), mock(RegistroPesoRepository.class),
                mock(PastaRepository.class), mock(PlanoTreinoRepository.class), mock(PlanoDietaRepository.class),
                mock(ReceitaService.class), mock(Auditoria.class), mock(ImportacaoRepository.class), transacoes);
    }

    @AfterEach
    void limpar() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    private static GrupoImportavel grupo(String id, String nome, OrigemDoNome origem) {
        return new GrupoImportavel(id, id, nome, "CRIAR_ALUNO", null, List.of(),
                new CadastroImportavel(nome, null, null, null, null, true), List.of(), null, null, List.of(),
                "PENDENTE", null, List.of(), Map.of(), List.of(), origem);
    }

    /** Sessão em revisão com os grupos dados, confirmada de uma vez com todos eles. */
    private ConfirmacaoResultado confirmarTodos(GrupoImportavel... grupos) {
        ImportacaoSessao sessao = new ImportacaoSessao(usuarioId);
        ReflectionTestUtils.setField(sessao, "id", UUID.randomUUID());
        sessao.atualizarEstado("REVISANDO");
        SessaoJson.gravarGrupos(json, sessao, List.of(grupos));
        when(sessoes.buscarParaAlterar(sessao.getId(), consultoriaId)).thenReturn(Optional.of(sessao));
        String hash = HashPreviaImportacao.calcular(sessao, List.of(grupos));
        List<String> ids = java.util.Arrays.stream(grupos).map(GrupoImportavel::id).toList();
        ConfirmacaoResultado r = confirmacao.confirmar(sessao.getId(), usuarioId,
                new ConfirmarSessaoRequisicao(ids, sessao.getRevisao(), hash, UUID.randomUUID().toString()));
        ultimaSessao = sessao;
        return r;
    }

    @Test
    void doisGruposComOMesmoNomeLidoDoConteudoNaMesmaSessaoOSegundoERecusado() {
        ConfirmacaoResultado r = confirmarTodos(grupo("grupo-1", "Fulano Ficticio", OrigemDoNome.CONTEUDO),
                grupo("grupo-2", "FULANO FICTICIO", OrigemDoNome.CONTEUDO));

        assertThat(r.alunosCriados()).isEqualTo(1);
        assertThat(r.gruposComErro()).isEqualTo(1);
        verify(alunoService, times(1)).criar(any());
        GrupoImportavel segundo = SessaoJson.grupos(json, ultimaSessao).get(1);
        assertThat(segundo.estado()).isEqualTo("ERRO");
        assertThat(segundo.erroCodigo()).isEqualTo("MESMO_NOME_NA_SESSAO");
        // O progresso guarda só o id do aluno criado, nunca o nome.
        assertThat(SessaoJson.alunosCriados(json, ultimaSessao)).hasSize(1);
        assertThat(ultimaSessao.getProgressoJson()).doesNotContain("Fulano");
    }

    @Test
    void alunoNovoComONomeSubstitutoERecusadoAntesDeQualquerEfeito() {
        for (OrigemDoNome origem : new OrigemDoNome[] {OrigemDoNome.NOME_DO_ARQUIVO, OrigemDoNome.TITULO_DO_TEXTO,
                OrigemDoNome.AUSENTE, null}) {
            assertThatThrownBy(() -> confirmarTodos(grupo("grupo-1", "Fulano Ficticio", OrigemDoNome.CONTEUDO),
                    grupo("grupo-2", "Aluno 2", origem)))
                    .as("origem %s", origem)
                    .isInstanceOfSatisfying(ValidacaoException.class, e -> {
                        assertThat(e.getCodigo()).isEqualTo("NOME_DO_ALUNO_PENDENTE");
                        assertThat(e.getProblemas()).singleElement().satisfies(f -> {
                            assertThat(f.field()).isEqualTo("grupos.grupo-2.nome");
                            assertThat(f.message()).isEqualTo("Informe o nome do aluno, vincule a um existente ou ignore.");
                        });
                    });
        }
        // Nem o grupo com o nome lido foi gravado: a recusa vem antes de qualquer efeito.
        verify(alunoService, never()).criar(any());
    }

    @Test
    void substitutoSalvoComoModeloNaoTrava() {
        GrupoImportavel modelo = new GrupoImportavel("grupo-1", "grupo-1", "Aluno 1", "MODELO_BIBLIOTECA", null, List.of(),
                null, List.of(), new ConteudoTreino(null, null, List.of()), null, List.of(), "PRONTO", null,
                List.of(), Map.of(), List.of(), OrigemDoNome.AUSENTE);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("u", null,
                List.of(new SimpleGrantedAuthority("PERM_MODELO_ALTERAR"))));
        ConfirmacaoResultado r = confirmarTodos(modelo);

        assertThat(r.gruposComErro()).isZero();
        assertThat(r.modelosCriados()).isEqualTo(1);
    }

    @Test
    void doisGruposComONomeDigitadoIgualGravamOsDoisSemTravaPorNome() {
        ConfirmacaoResultado r = confirmarTodos(grupo("grupo-1", "Fulano Ficticio", OrigemDoNome.DIGITADO),
                grupo("grupo-2", "Fulano Ficticio", OrigemDoNome.DIGITADO));

        assertThat(r.alunosCriados()).isEqualTo(2);
        assertThat(r.gruposComErro()).isZero();
        assertThat(SessaoJson.grupos(json, ultimaSessao)).allMatch(g -> "IMPORTADO".equals(g.estado()));
        // O nome digitado não entra na lista da trava por nome (só o lido do conteúdo).
        assertThat(SessaoJson.alunosCriados(json, ultimaSessao)).isEmpty();
    }

    @Test
    void nomeDigitadoIgualAoNomeLidoJaCriadoNaSessaoTambemGrava() {
        ConfirmacaoResultado r = confirmarTodos(grupo("grupo-1", "Fulano Ficticio", OrigemDoNome.CONTEUDO),
                grupo("grupo-2", "Fulano Ficticio", OrigemDoNome.DIGITADO));

        assertThat(r.alunosCriados()).isEqualTo(2);
        assertThat(r.gruposComErro()).isZero();
    }
}
