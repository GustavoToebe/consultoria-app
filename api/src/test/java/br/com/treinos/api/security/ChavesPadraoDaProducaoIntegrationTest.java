package br.com.treinos.api.security;

import br.com.treinos.api.AbstractIntegrationTest;
import br.com.treinos.api.ApiDeTeste;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regra de 28/11 ("tudo liberado"): o padrão de cada chave de funcionalidade no {@code application.yml} (o que a produção recebe
 * com a variável ausente) e a prova de que, com esses padrões e SEM nenhum segredo (o {@code application-test.yml} injeta chaves de
 * pagamentos, WhatsApp, MFA e e-mail; aqui tudo é esvaziado), a API sobe. Ficam {@code false} só as que recusariam a subida sem
 * segredo, o e-mail (o provedor log fingiria envio), o bloqueio da Central (sem integração derrubaria o login), o cadastro aberto
 * (só depois do Turnstile) e o cardio (decisão de lançamento). Mudar um padrão = mudar o mapa e o {@code docs/planos/liberacao-01-12.md}.
 */
@AutoConfigureMockMvc
class ChavesPadraoDaProducaoIntegrationTest extends AbstractIntegrationTest {

    /** Propriedade → padrão esperado no yml (a variável é a do próprio placeholder). */
    static final Map<String, String> PADROES = new LinkedHashMap<>();

    static {
        PADROES.put("treinos.plano.aplicar", "true");
        PADROES.put("treinos.importacao.ia.enviar-dados-ao-provedor", "true");
        PADROES.put("treinos.cep.habilitado", "true");
        PADROES.put("treinos.ciclo.habilitado", "true");
        PADROES.put("treinos.retorno.habilitado", "true");
        PADROES.put("treinos.push.habilitado", "true");
        PADROES.put("treinos.contratos.habilitado", "true");
        PADROES.put("treinos.regras-atencao.habilitado", "true");
        PADROES.put("treinos.vitrine.habilitada", "true");
        PADROES.put("treinos.vitrine.loja-habilitada", "true");
        PADROES.put("treinos.vitrine.marketplace-habilitado", "true");
        PADROES.put("treinos.unidade-carga.habilitado", "true");
        PADROES.put("treinos.migracao-assistida.habilitado", "true");
        PADROES.put("treinos.pagamentos.habilitado", "true");
        PADROES.put("treinos.pagamentos.pagar-no-ios", "true");
        PADROES.put("treinos.pagamentos.pagar-no-android", "true");
        // Ligadas sem segredo, a API recusa a subida: ligar no consultoria.env junto com as variáveis delas.
        PADROES.put("treinos.integracao.ativa", "false");
        PADROES.put("treinos.turnstile.habilitado", "false");
        PADROES.put("treinos.whatsapp.habilitado", "false");
        PADROES.put("treinos.fotos.habilitado", "false");
        PADROES.put("treinos.pagamentos.infinitepay.habilitado", "false");
        PADROES.put("treinos.pagamentos.kiwify.habilitado", "false");
        PADROES.put("treinos.pagamentos.asaas.habilitado", "false");
        // Sobe, mas não funciona sem configuração: o e-mail com o provedor log e o bloqueio sem a integração sincronizando.
        PADROES.put("plataforma.auth.email.habilitado", "false");
        PADROES.put("plataforma.auth.redefinicao.habilitado", "false");
        PADROES.put("treinos.integracao.bloqueio-ativo", "false");
        // Cadastro aberto só pelo ambiente, depois do Turnstile ligado (decisão de 29/11): esquecer a variável não abre sem proteção.
        PADROES.put("treinos.cadastro.aberto", "false");
        // Única exceção da regra: até o APK novo estar nos aparelhos de teste.
        PADROES.put("treinos.cardio.intervalado-habilitado", "false");
    }

    private static final Pattern PLACEHOLDER = Pattern.compile("^\\$\\{[A-Z0-9_]+:(true|false)}$");

    @DynamicPropertySource
    static void comoAProducaoSemSegredos(DynamicPropertyRegistry registry) {
        PADROES.forEach((chave, valor) -> registry.add(chave, () -> valor));
        // O teste cria o treinador pelo cadastro público; fechado (o padrão) é a CadastroFechadoIntegrationTest.
        registry.add("treinos.cadastro.aberto", () -> "true");
        for (String segredo : new String[] {"treinos.pagamentos.chaves", "treinos.pagamentos.chave-ativa",
                "treinos.pagamentos.infinitepay.url-publica", "treinos.whatsapp.chaves", "treinos.whatsapp.chave-ativa",
                "treinos.whatsapp.meta-app-secret", "treinos.whatsapp.meta-verify-token", "treinos.fotos.endpoint",
                "treinos.fotos.bucket", "treinos.fotos.chave", "treinos.fotos.segredo", "plataforma.auth.mfa.chaves",
                "plataforma.auth.mfa.chave-ativa", "plataforma.auth.email.remetente"}) {
            registry.add(segredo, () -> "");
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private JsonMapper json;

    @Test
    void oApplicationYmlTrazOsPadroesDaRegraDe28De11() {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        Properties padrao = yaml.getObject();
        assertThat(padrao).isNotNull();
        PADROES.forEach((chave, esperado) -> {
            Matcher m = PLACEHOLDER.matcher(String.valueOf(padrao.getProperty(chave)));
            assertThat(m.matches()).as(chave + " é ${VARIAVEL:true|false}").isTrue();
            assertThat(m.group(1)).as(chave).isEqualTo(esperado);
        });
    }

    @Test
    void sobeSemNenhumSegredoEOEuRefleteOsPadroes() throws Exception {
        ApiDeTeste api = new ApiDeTeste(mvc, json);
        JsonNode admin = api.novoTreinador();
        JsonNode eu = api.get("/eu", admin, 200);
        for (String ligada : new String[] {"pagamentosHabilitados", "pagarNoIos", "pagarNoAndroid", "cicloHabilitado",
                "retornoHabilitado", "pushHabilitado", "unidadeDeCargaHabilitada", "migracaoAssistidaHabilitada",
                "vitrineHabilitada", "lojaHabilitada", "marketplaceHabilitado", "contratosHabilitados",
                "regrasAtencaoHabilitada"}) {
            assertThat(eu.path(ligada).asBoolean()).as(ligada).isTrue();
        }
        for (String desligada : new String[] {"recebimentoOnlineHabilitado", "kiwifyHabilitada", "overtrainingPayHabilitado",
                "whatsappHabilitado", "cardioIntervaladoHabilitado"}) {
            assertThat(eu.path(desligada).asBoolean()).as(desligada).isFalse();
        }
        // Plano aplicado ligado, mas a consultoria sem linha em direitos_locais: nada é barrado.
        assertThat(eu.path("funcionalidadesDoPlano").valueStream().map(JsonNode::asString).toList())
                .containsExactly("MOBILIDADE", "PDF", "EQUIPE");
    }
}
