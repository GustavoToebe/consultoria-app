package br.com.treinos.api.biblioteca;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CatalogoAlimentoRepository extends JpaRepository<CatalogoAlimento, UUID> {

    /**
     * {@code padrao} já vem sem acento ({@code Buscas.padraoSemAcento}); {@code semGrupos} não filtra por grupo (então
     * {@code grupos} leva um valor qualquer, porque {@code in ()} vazio não vale); {@code semUnidades} idem para a unidade.
     * {@code biblioteca}: 0 = todos, 1 = só os de nome em {@code nomes}, 2 = só os de fora (nomes em minúsculas, como
     * {@code AlimentoRepository.nomesAtivos}).
     */
    @Query("select c from CatalogoAlimento c where c.nomeBusca like :padrao escape '\\' "
            + "and (:semGrupos = true or c.grupo in :grupos) "
            + "and (:semUnidades = true or c.baseUnidade in :unidades) "
            + "and (:biblioteca = 0 or (:biblioteca = 1 and lower(c.nome) in :nomes) "
            + "or (:biblioteca = 2 and lower(c.nome) not in :nomes)) order by c.nome")
    Page<CatalogoAlimento> buscar(String padrao, boolean semGrupos, Collection<String> grupos, boolean semUnidades,
                                  Collection<String> unidades, int biblioteca,
                                  Collection<String> nomes, Pageable pagina);

    @Query("select distinct c.grupo from CatalogoAlimento c where c.grupo is not null order by c.grupo")
    List<String> grupos();

    List<CatalogoAlimento> findByNomeBusca(String nomeBusca);
}
