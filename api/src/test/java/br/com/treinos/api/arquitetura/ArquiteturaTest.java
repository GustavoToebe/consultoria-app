package br.com.treinos.api.arquitetura;

import com.tngtech.archunit.base.DescribedPredicate;
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
import org.springframework.data.jpa.repository.Query;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
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
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_USE_FIELD_INJECTION;
import static com.tngtech.archunit.library.GeneralCodingRules.NO_CLASSES_SHOULD_USE_JAVA_UTIL_LOGGING;

/**
 * Regras da seção 5 do plano que viraram teste (como o {@code ArquiteturaTest} da Central). Exceção nova entra numa
 * das listas abaixo, com o porquê: a lista é o lugar visível da decisão.
 */
class ArquiteturaTest {

    private static JavaClasses codigo;

    /**
     * SQL nativo, sempre com consultoria/aluno explícitos:
     * {@code ContadorBanco} (contador de login com {@code ON CONFLICT} atômico);
     * {@code ExecucaoUpsert} (registro idempotente do aluno, {@code ON CONFLICT ... WHERE} mais novo);
     * {@code LogoRepositorio} (bytes da logo fora da entidade, filtrado pelo id da consultoria);
     * {@code ConviteEquipeBusca} (descobre apenas o tenant pelo hash para o aceite público da equipe);
     * {@code ConviteBusca} (convite público: descobre só a consultoria do convite antes de abrir a sessão nela).
     */
    private static final Set<String> SQL_NATIVO_PERMITIDO = Set.of("ContadorBanco", "ExecucaoUpsert",
            "LogoRepositorio", "ConviteBusca", "ConviteEquipeBusca");

    /**
     * Entidades sem {@code @TenantId}: {@code Consultoria} é a raiz do isolamento; {@code Usuario} e
     * {@code RefreshToken} são do login, que acontece antes de saber a consultoria; {@code CatalogoExercicio} e
     * {@code CatalogoAlimento} são o catálogo público, igual para todos e só leitura. AtualizacaoModelo é o questionário global versionado, sem respostas.
     */
    private static final Set<String> ENTIDADES_GLOBAIS = Set.of("Consultoria", "Usuario", "RefreshToken",
            "CatalogoExercicio", "CatalogoAlimento", "AtualizacaoModelo");

    /** Controllers das rotas públicas da seção 5.4 (login, refresh, cadastro, convite, logo). */
    private static final Set<String> CONTROLLERS_PUBLICOS = Set.of("AuthController", "ConvitePublicoController",
            "MarcaPublicaController", "ConviteEquipePublicoController");

    @BeforeAll
    static void importar() {
        codigo = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("br.com.treinos.api");
    }

    @Test
    void listasDeExcecaoSoCitamClassesQueExistem() {
        Set<String> todas = codigo.stream().map(JavaClass::getSimpleName).collect(Collectors.toSet());
        org.assertj.core.api.Assertions.assertThat(todas).as("SQL_NATIVO_PERMITIDO").containsAll(SQL_NATIVO_PERMITIDO);
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
                .because("um treinador nunca vê dado de outra consultoria (regra 1 do plano)")
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
                .because("toda rota nova declara o papel (seção 5.4 do plano)")
                .check(codigo);
    }

    @Test
    void rotaDaEquipeDeclaraPermissao() {
        classes().that().areAnnotatedWith(RestController.class)
                .and(DescribedPredicate.describe("rotas da equipe (exceto /eu compartilhado e rotas públicas/aluno)",
                        (JavaClass c) -> !CONTROLLERS_PUBLICOS.contains(c.getSimpleName())
                                && !Set.of("EuController", "AlunoAppController", "AtualizacaoAlunoController").contains(c.getSimpleName())))
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
    void sqlNativoSoNasClassesPermitidas() {
        DescribedPredicate<JavaClass> foraDaLista = DescribedPredicate.describe("não estão em SQL_NATIVO_PERMITIDO",
                (JavaClass c) -> !SQL_NATIVO_PERMITIDO.contains(c.getSimpleName()));
        noClasses().that(foraDaLista)
                .should().dependOnClassesThat().haveFullyQualifiedName("org.springframework.jdbc.core.JdbcTemplate")
                .orShould().dependOnClassesThat().haveFullyQualifiedName("org.springframework.jdbc.core.simple.JdbcClient")
                .orShould().dependOnClassesThat()
                .haveFullyQualifiedName("org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate")
                .orShould().callMethod(jakarta.persistence.EntityManager.class, "createNativeQuery", String.class)
                .orShould().callMethod(jakarta.persistence.EntityManager.class, "createNativeQuery", String.class,
                        Class.class)
                .because("@TenantId não protege SQL nativo; toda consulta nativa filtra a consultoria à mão")
                .check(codigo);
        noClasses().that(foraDaLista)
                .should(new ArchCondition<>("declarar @Query(nativeQuery = true)") {
                    @Override
                    public void check(JavaClass c, ConditionEvents eventos) {
                        c.getMethods().stream()
                                .filter(m -> m.isAnnotatedWith(Query.class) && m.getAnnotationOfType(Query.class).nativeQuery())
                                .forEach(m -> eventos.add(SimpleConditionEvent.satisfied(m, m.getFullName() + " usa SQL nativo")));
                    }
                })
                .check(codigo);
    }

    @Test
    void controllerSoFalaComService() {
        noClasses().that().areAnnotatedWith(RestController.class)
                .should().dependOnClassesThat().haveSimpleNameEndingWith("Repository")
                .orShould().dependOnClassesThat().haveFullyQualifiedName("jakarta.persistence.EntityManager")
                .orShould().dependOnClassesThat().haveFullyQualifiedName("org.springframework.jdbc.core.JdbcTemplate")
                .because("regra de negócio e transação ficam no service")
                .check(codigo);
    }

    @Test
    void controllerNaoAbreTransacao() {
        noClasses().that().areAnnotatedWith(RestController.class)
                .should().beAnnotatedWith(Transactional.class)
                .check(codigo);
        noClasses().that().areAnnotatedWith(RestController.class)
                .should(new ArchCondition<>("ter método @Transactional") {
                    @Override
                    public void check(JavaClass c, ConditionEvents eventos) {
                        c.getMethods().stream().filter(m -> m.isAnnotatedWith(Transactional.class))
                                .forEach(m -> eventos.add(SimpleConditionEvent.satisfied(m, m.getFullName() + " é @Transactional")));
                    }
                })
                .check(codigo);
    }

    @Test
    void serviceERepositorioNaoDependemDeController() {
        noClasses().that().areNotAnnotatedWith(RestController.class)
                .should().dependOnClassesThat().areAnnotatedWith(RestController.class)
                .check(codigo);
    }

    @Test
    void jacksonTresNoCodigo() {
        noClasses().should().dependOnClassesThat()
                .resideInAnyPackage("com.fasterxml.jackson.databind..", "com.fasterxml.jackson.core..")
                .because("o projeto usa Jackson 3 (tools.jackson.*); de com.fasterxml só as anotações e o motor do jjwt")
                .check(codigo);
    }

    @Test
    void injecaoPorConstrutorELogPorSlf4j() {
        NO_CLASSES_SHOULD_USE_FIELD_INJECTION.check(codigo);
        NO_CLASSES_SHOULD_USE_JAVA_UTIL_LOGGING.check(codigo);
        NO_CLASSES_SHOULD_ACCESS_STANDARD_STREAMS.check(codigo);
    }

    private static boolean eRota(JavaMethod m) {
        return m.isAnnotatedWith(GetMapping.class) || m.isAnnotatedWith(PostMapping.class)
                || m.isAnnotatedWith(PutMapping.class) || m.isAnnotatedWith(PatchMapping.class)
                || m.isAnnotatedWith(DeleteMapping.class) || m.isAnnotatedWith(RequestMapping.class);
    }
}
