package br.com.treinos.api.equipe;
import br.com.treinos.api.web.BadRequestException;
import org.junit.jupiter.api.Test;
import java.util.Set;
import static org.assertj.core.api.Assertions.*;
class CatalogoPermissoesTest {
    @Test void publicacaoEDadosSensiveisExigemDependencias() {
        assertThatThrownBy(() -> CatalogoPermissoes.validar(Set.of("TREINO_PUBLICAR"))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> CatalogoPermissoes.validar(Set.of("CODIGO_INVENTADO"))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> CatalogoPermissoes.validar(null)).isInstanceOf(BadRequestException.class);
        assertThat(CatalogoPermissoes.validar(CatalogoPermissoes.comDependencias(Set.of("ATUALIZACAO_RESPONDER"))))
                .containsExactlyInAnyOrder("ATUALIZACAO_RESPONDER","ATUALIZACAO_LER","ALUNO_SENSIVEL_LER","ALUNO_LER");
        assertThat(CatalogoPermissoes.validar(CatalogoPermissoes.comDependencias(Set.of("DIETA_PUBLICAR"))))
                .containsExactlyInAnyOrder("DIETA_PUBLICAR","DIETA_ALTERAR","DIETA_LER");
    }
}
