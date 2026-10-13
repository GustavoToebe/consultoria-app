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
        var comNulo=new java.util.HashSet<String>();comNulo.add("ALUNO_LER");comNulo.add(null);
        assertThatThrownBy(() -> CatalogoPermissoes.validar(comNulo)).isInstanceOf(BadRequestException.class);
        assertThat(CatalogoPermissoes.validar(CatalogoPermissoes.comDependencias(Set.of("ATUALIZACAO_RESPONDER"))))
                .containsExactlyInAnyOrder("ATUALIZACAO_RESPONDER","ATUALIZACAO_LER","ALUNO_SENSIVEL_LER","ALUNO_LER");
        assertThat(CatalogoPermissoes.validar(CatalogoPermissoes.comDependencias(Set.of("DIETA_PUBLICAR"))))
                .containsExactlyInAnyOrder("DIETA_PUBLICAR","DIETA_ALTERAR","DIETA_LER");
    }
    @Test void questionariosAlterarExigeLerENaoSaoSensiveis() {
        assertThat(CatalogoPermissoes.CATALOGO).filteredOn(p -> p.codigo().startsWith("QUESTIONARIO_"))
                .extracting(CatalogoPermissoes.Permissao::codigo,CatalogoPermissoes.Permissao::sensivel)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("QUESTIONARIO_LER",false),org.assertj.core.groups.Tuple.tuple("QUESTIONARIO_ALTERAR",false));
        assertThatThrownBy(() -> CatalogoPermissoes.validar(Set.of("QUESTIONARIO_ALTERAR"))).isInstanceOf(BadRequestException.class);
        assertThat(CatalogoPermissoes.validar(CatalogoPermissoes.comDependencias(Set.of("QUESTIONARIO_ALTERAR"))))
                .containsExactlyInAnyOrder("QUESTIONARIO_ALTERAR","QUESTIONARIO_LER");
    }
    @Test void ergogenicosSaoSensiveisEDependemDaBiblioteca() {
        assertThat(CatalogoPermissoes.CATALOGO).filteredOn(p -> p.codigo().startsWith("ERGOGENICO_"))
                .extracting(CatalogoPermissoes.Permissao::sensivel).containsExactly(true,true);
        assertThat(CatalogoPermissoes.validar(CatalogoPermissoes.comDependencias(Set.of("ERGOGENICO_ALTERAR"))))
                .containsExactlyInAnyOrder("ERGOGENICO_ALTERAR","ERGOGENICO_LER","BIBLIOTECA_LER");
        assertThatThrownBy(() -> CatalogoPermissoes.validar(Set.of("ERGOGENICO_ALTERAR"))).isInstanceOf(BadRequestException.class);
    }
}
