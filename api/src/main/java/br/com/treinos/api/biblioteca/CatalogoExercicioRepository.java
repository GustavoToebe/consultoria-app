package br.com.treinos.api.biblioteca;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CatalogoExercicioRepository extends JpaRepository<CatalogoExercicio, UUID> {

    /**
     * {@code padrao} já vem sem acento ({@code Buscas.padraoSemAcento}); {@code semGrupos} e {@code semModalidades} não
     * filtram (então a lista leva um valor qualquer, porque {@code in ()} vazio não vale); {@code imagem} nulo não filtra.
     * {@code biblioteca}: 0 = todos, 1 = só os de nome em {@code nomes}, 2 = só os de fora (nomes em minúsculas, como
     * {@code ExercicioRepository.nomesAtivos}; nunca vazia, pelo mesmo motivo).
     */
    @Query("select c from CatalogoExercicio c where c.nomeBusca like :padrao escape '\\' "
            + "and (:semGrupos = true or c.grupoMuscular in :grupos) "
            + "and (:semModalidades = true or c.modalidade in :modalidades) "
            + "and (:imagem is null or (:imagem = true and coalesce(array_length(c.imagens), 0) > 0) "
            + "or (:imagem = false and coalesce(array_length(c.imagens), 0) = 0)) "
            + "and (:biblioteca = 0 or (:biblioteca = 1 and lower(c.nome) in :nomes) "
            + "or (:biblioteca = 2 and lower(c.nome) not in :nomes)) order by c.nome")
    Page<CatalogoExercicio> buscar(String padrao, boolean semGrupos, Collection<String> grupos, boolean semModalidades,
                                   Collection<String> modalidades, Boolean imagem, int biblioteca, Collection<String> nomes,
                                   Pageable pagina);

    @Query("select distinct c.grupoMuscular from CatalogoExercicio c where c.grupoMuscular is not null "
            + "order by c.grupoMuscular")
    List<String> grupos();
}
