package br.com.treinos.api.fotos;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

/** Subida da aplicação com as fotos desligadas, ligadas sem configuração e ligadas com tudo. Sem rede e sem Spring completo. */
class FotosConfiguracaoTest {

    private final ApplicationContextRunner contexto = new ApplicationContextRunner().withUserConfiguration(FotosConfiguracao.class);

    @Test
    void desligadoSobeSemNadaConfiguradoENaoCriaOBucket() {
        contexto.run(c -> {
            assertThat(c).hasNotFailed();
            assertThat(c).doesNotHaveBean(ArmazenamentoDeFotos.class);
            assertThat(c.getBean(FotosProperties.class).habilitado()).isFalse();
        });
        contexto.withPropertyValues("treinos.fotos.habilitado=false", "treinos.fotos.segredo=ignorado").run(c -> {
            assertThat(c).hasNotFailed();
            assertThat(c).doesNotHaveBean(ArmazenamentoDeFotos.class);
        });
    }

    @Test
    void ligadoSemConfiguracaoNaoSobeEDizSoONomeDaVariavelQueFalta() {
        contexto.withPropertyValues("treinos.fotos.habilitado=true").run(c -> {
            assertThat(c).hasFailed();
            assertThat(rastro(c.getStartupFailure())).contains("TREINOS_FOTOS_ENDPOINT");
        });
        contexto.withPropertyValues("treinos.fotos.habilitado=true", "treinos.fotos.endpoint=https://exemplo.invalido",
                "treinos.fotos.bucket=b", "treinos.fotos.chave=chave-de-teste").run(c -> {
            assertThat(c).hasFailed();
            String rastro = rastro(c.getStartupFailure());
            assertThat(rastro).contains("TREINOS_FOTOS_SEGREDO").doesNotContain("chave-de-teste");
        });
    }

    @Test
    void endpointQueNaoEUrlNaoSobe() {
        contexto.withPropertyValues("treinos.fotos.habilitado=true", "treinos.fotos.endpoint=nao-e-url",
                "treinos.fotos.bucket=b", "treinos.fotos.chave=c", "treinos.fotos.segredo=s").run(c -> assertThat(c).hasFailed());
    }

    @Test
    void ligadoComTudoCriaOBucketSemChamarARede() {
        contexto.withPropertyValues("treinos.fotos.habilitado=true", "treinos.fotos.endpoint=https://exemplo.invalido",
                "treinos.fotos.bucket=b", "treinos.fotos.chave=chave-de-teste", "treinos.fotos.segredo=segredo-de-teste").run(c -> {
            assertThat(c).hasNotFailed();
            assertThat(c).hasSingleBean(ArmazenamentoDeFotos.class);
            assertThat(c.getBean(FotosProperties.class).regiao()).isEqualTo("auto");
        });
    }

    @Test
    void oObjetoDeConfiguracaoNaoMostraSegredoNoToString() {
        var p = new FotosProperties(true, "https://x", "b", "chave-secreta", "segredo-secreto", null, null);
        assertThat(p.toString()).doesNotContain("secret").doesNotContain("chave-secreta").doesNotContain("segredo-secreto");
    }

    private static String rastro(Throwable falha) {
        StringBuilder texto = new StringBuilder();
        for (Throwable t = falha; t != null; t = t.getCause()) {
            texto.append(t.getMessage()).append('\n');
        }
        return texto.toString();
    }
}
