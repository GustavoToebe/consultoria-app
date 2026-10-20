package br.com.treinos.api.arquitetura;

import com.tngtech.archunit.base.DescribedPredicate;
import br.com.plataforma.comum.teste.RegrasDeArquitetura;
import br.com.treinos.api.pagamentos.ExigePagamentos;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import jakarta.persistence.Entity;
import org.hibernate.annotations.TenantId;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;
import java.util.stream.Collectors;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Regras de arquitetura que viraram teste (como o {@code ArquiteturaTest} da Central). Exceção nova entra numa
 * das listas abaixo, com o porquê: a lista é o lugar visível da decisão.
 */
class ArquiteturaTest {

    private static JavaClasses codigo;

    /**
     * SQL nativo, sempre com consultoria/aluno explícitos:
     * {@code ContadorBanco} (contador de login com {@code ON CONFLICT} atômico);
     * {@code ExecucaoUpsert} (registro idempotente do aluno, {@code ON CONFLICT ... WHERE} mais novo);
     * {@code MobilidadeRegistroUpsert} (item de mobilidade marcado pelo aluno, idempotente pelo id do aparelho,
     * {@code ON CONFLICT ... WHERE} mais novo; consultoria e aluno vêm da sessão, como no {@code ExecucaoUpsert});
     * {@code LogoRepositorio} (bytes da logo fora da entidade, filtrado pelo id da consultoria);
     * {@code AuditoriaGravacao} (insert na transação global do login e limpeza diária, sempre com consultoria explícita);
     * {@code ConviteEquipeBusca} (descobre apenas o tenant pelo hash, e se o convite é do sistema, para o aceite público da equipe);
     * {@code ConviteBusca} (convite público: descobre só a consultoria do convite antes de abrir a sessão nela);
     * {@code ContaLocalRepositorio} (tabelas globais da Minha conta, lidas também fora do tenant pela integração futura:
     * todo método recebe e filtra {@code consultoria_id});
     * {@code IntegracaoRepositorio} (nonce, operações idempotentes e provisionamento da integração com a Central: roda
     * fora do tenant, e todo método recebe e filtra {@code consultoria_id});
     * {@code AnonimizacaoRepositorio} (anonimização do aluno: limpa texto livre de {@code execucao_serie} e títulos de versões,
     * que a JPA trata como imutáveis; todo método filtra {@code consultoria_id} e {@code aluno_id});
     * {@code FotoRemocaoRepositorio} (fila durável de remoção das fotos no bucket e limpeza das fotos pendentes vencidas: roda no job, sem tenant,
     * e só mexe em ids de objeto e em linhas ainda não ligadas a nenhuma atualização; nenhum método devolve dado de pessoa);
     * {@code InscricaoBusca} (link público de inscrição: descobre só a consultoria de um link aberto pelo código, antes de abrir a
     * sessão nela).
     */
    private static final Set<String> SQL_NATIVO_PERMITIDO = Set.of(
            "br.com.treinos.api.auth.ContadorBanco",
            "br.com.treinos.api.execucao.ExecucaoUpsert",
            "br.com.treinos.api.mobilidade.MobilidadeRegistroUpsert",
            "br.com.treinos.api.consultoria.LogoRepositorio",
            "br.com.treinos.api.alunos.ConviteBusca",
            "br.com.treinos.api.equipe.ConviteEquipeBusca",
            "br.com.treinos.api.auditoria.AuditoriaGravacao",
            "br.com.treinos.api.conta.ContaLocalRepositorio",
            "br.com.treinos.api.integracao.IntegracaoRepositorio",
            "br.com.treinos.api.privacidade.AnonimizacaoRepositorio",
            "br.com.treinos.api.fotos.FotoRemocaoRepositorio",
            "br.com.treinos.api.inscricoes.InscricaoBusca");

    /**
     * Entidades sem {@code @TenantId}: {@code Consultoria} é a raiz do isolamento; {@code Usuario}
     * é do login, que acontece antes de saber a consultoria; {@code CatalogoExercicio} e
     * {@code CatalogoAlimento} são o catálogo público, igual para todos e só leitura. AtualizacaoModelo é o questionário global versionado, sem respostas.
     */
    private static final Set<String> ENTIDADES_GLOBAIS = Set.of("Consultoria", "Usuario",
            "CatalogoExercicio", "CatalogoAlimento", "AtualizacaoModelo");

    /** Controllers das rotas públicas (login, refresh, cadastro, convite, logo, inscrição pelo link). */
    private static final Set<String> CONTROLLERS_PUBLICOS = Set.of("AuthController", "ConvitePublicoController",
            "MarcaPublicaController", "ConviteEquipePublicoController", "ConfiguracaoPublicaController",
            "InscricaoPublicaController");

    @BeforeAll
    static void importar() {
        codigo = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("br.com.treinos.api");
    }

    @Test
    void listasDeExcecaoSoCitamClassesQueExistem() {
        RegrasDeArquitetura.exigirQueAsExcecoesExistem(codigo, "SQL_NATIVO_PERMITIDO", SQL_NATIVO_PERMITIDO);
        Set<String> todas = codigo.stream().map(JavaClass::getSimpleName).collect(Collectors.toSet());
        org.assertj.core.api.Assertions.assertThat(todas).as("ENTIDADES_GLOBAIS").containsAll(ENTIDADES_GLOBAIS);
        org.assertj.core.api.Assertions.assertThat(todas).as("CONTROLLERS_PUBLICOS").containsAll(CONTROLLERS_PUBLICOS);
    }

    @Test
    void entidadeDeNegocioTemTenantId() {
        classes().that().areAnnotatedWith(Entity.class)
                .and(DescribedPredicate.describe("não estão em ENTIDADES_GLOBAIS",
                        (JavaClass c) -> !ENTIDADES_GLOBAIS.contains(c.getSimpleName())))
                .should(new ArchCondition<>("ter um campo @TenantId") {
                    @Override
                    public void check(JavaClass c, ConditionEvents eventos) {
                        boolean tem = c.getAllFields().stream().anyMatch(f -> f.isAnnotatedWith(TenantId.class));
                        if (!tem) {
                            eventos.add(SimpleConditionEvent.violated(c, c.getName() + " não tem @TenantId"));
                        }
                    }
                })
                .because("um treinador nunca vê dado de outra consultoria")
                .check(codigo);
    }

    @Test
    void rotaDeControllerNaoPublicoTemPreAuthorize() {
        classes().that().areAnnotatedWith(RestController.class)
                .and(DescribedPredicate.describe("não estão em CONTROLLERS_PUBLICOS",
                        (JavaClass c) -> !CONTROLLERS_PUBLICOS.contains(c.getSimpleName())))
                .should(new ArchCondition<>("ter @PreAuthorize em toda rota") {
                    @Override
                    public void check(JavaClass c, ConditionEvents eventos) {
                        c.getMethods().stream().filter(ArquiteturaTest::eRota)
                                .filter(m -> !m.isAnnotatedWith(PreAuthorize.class))
                                .forEach(m -> eventos.add(SimpleConditionEvent.violated(m,
                                        m.getFullName() + " não tem @PreAuthorize")));
                    }
                })
                .because("toda rota nova declara o papel")
                .check(codigo);
    }

    @Test
    void rotaDaEquipeDeclaraPermissao() {
        classes().that().areAnnotatedWith(RestController.class)
                .and(DescribedPredicate.describe("rotas da equipe (exceto /eu, /eu/mfa e /termos, que são da própria conta, e rotas públicas/aluno)",
                        (JavaClass c) -> !CONTROLLERS_PUBLICOS.contains(c.getSimpleName())
                                && !Set.of("EuController", "MfaController", "TermosController", "AlunoAppController", "AtualizacaoAlunoController", "FotoAlunoController",
                                // Foto de perfil do próprio aluno (hasRole ALUNO, sempre a da sessão); a da equipe declara PERM_ALUNO_LER.
                                "FotoPerfilAlunoController",
                                // Anamnese do próprio aluno e imagens das perguntas que ele responde (hasRole ALUNO, sempre a da sessão).
                                "AnamneseAlunoController",
                                // Itens de mobilidade que o próprio aluno marca (hasRole ALUNO, sempre o da sessão); a leitura do treinador declara PERM_REGISTRO_LER.
                                "AlunoMobilidadeRegistrosController",
                                // "Excluir minha conta" (hasRole ALUNO, sempre a conta da sessão, com a senha dela).
                                "ExclusaoDeContaController",
                                // Plano comercial e cobranças do próprio aluno (hasRole ALUNO, sempre o da sessão, só leitura).
                                "AlunoFinanceiroController").contains(c.getSimpleName())))
                .should(new ArchCondition<>("usar hasAuthority(PERM_...) em toda rota") {
                    @Override public void check(JavaClass c, ConditionEvents eventos) {
                        c.getMethods().stream().filter(ArquiteturaTest::eRota).forEach(m -> {
                            if (!m.isAnnotatedWith(PreAuthorize.class)
                                    || !m.getAnnotationOfType(PreAuthorize.class).value().contains("hasAuthority('PERM_"))
                                eventos.add(SimpleConditionEvent.violated(m, m.getFullName()+" não declara permissão"));
                        });
                    }
                }).check(codigo);
    }

    @Test
    void controllerDePagamentosExigePagamentosHabilitados() {
        classes().that().areAnnotatedWith(RestController.class)
                .and().resideInAPackage("br.com.treinos.api.pagamentos..")
                .should().beAnnotatedWith(ExigePagamentos.class)
                .because("com TREINOS_PAGAMENTOS_HABILITADO=false toda rota do financeiro responde 503 (PagamentosInterceptor); "
                        + "controller novo sem a anotação ficaria aberto com o módulo desligado")
                .check(codigo);
    }

    @Test
    void sqlNativoSoNasClassesPermitidas() {
        RegrasDeArquitetura.sqlNativoSoEm(SQL_NATIVO_PERMITIDO).check(codigo);
    }

    @Test
    void controllerSoFalaComService() {
        RegrasDeArquitetura.CONTROLLER_SO_FALA_COM_SERVICE.check(codigo);
    }

    @Test
    void controllerNaoAbreTransacao() {
        RegrasDeArquitetura.CONTROLLER_NAO_ABRE_TRANSACAO.check(codigo);
    }

    @Test
    void serviceERepositorioNaoDependemDeController() {
        RegrasDeArquitetura.NADA_DEPENDE_DE_CONTROLLER.check(codigo);
    }

    @Test
    void modoSistemaSoParaOsSeedsDeDemonstracao() {
        noClasses().that().haveNameNotMatching("br\\.com\\.treinos\\.api\\.(demo\\.SeedDemo|execucao\\.SeedHistoricoDemo)(\\$.*)?")
                .should().callMethod(br.com.treinos.api.equipe.AcessoAtual.class, "comoSistema", java.util.function.Supplier.class)
                .because("comoSistema concede ALUNO_SENSIVEL_LER/ALTERAR sem usuário; só os seeds (sem HTTP) podem usar")
                .check(codigo);
    }

    @Test
    void gravacaoDeExecucaoNaoEPublica() {
        classes().that().haveSimpleName("ExecucaoUpsert").should().notBePublic()
                .because("grava execucao_serie com consultoria e aluno explícitos; só o pacote execucao (e o seed que mora nele) usa")
                .check(codigo);
    }

    @Test
    void gravacaoDeMobilidadeNaoEPublica() {
        classes().that().haveSimpleName("MobilidadeRegistroUpsert").should().notBePublic()
                .because("grava mobilidade_registro com consultoria e aluno explícitos; só o pacote mobilidade usa")
                .check(codigo);
    }

    @Test
    void jacksonTresNoCodigo() {
        RegrasDeArquitetura.JACKSON_TRES.check(codigo);
    }

    @Test
    void injecaoPorConstrutorELogPorSlf4j() {
        RegrasDeArquitetura.SEM_INJECAO_POR_CAMPO.check(codigo);
        RegrasDeArquitetura.SEM_JAVA_UTIL_LOGGING.check(codigo);
        RegrasDeArquitetura.SEM_SAIDA_PADRAO.check(codigo);
    }

    private static boolean eRota(JavaMethod m) {
        return m.isAnnotatedWith(GetMapping.class) || m.isAnnotatedWith(PostMapping.class)
                || m.isAnnotatedWith(PutMapping.class) || m.isAnnotatedWith(PatchMapping.class)
                || m.isAnnotatedWith(DeleteMapping.class) || m.isAnnotatedWith(RequestMapping.class);
    }
}
