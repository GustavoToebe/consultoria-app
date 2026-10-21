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
     * {@code grupos} leva um valor qualquer, porque {@code in ()} vazio não vale).
     */
    @Query("select c from CatalogoAlimento c where c.nomeBusca like :padrao escape '\\' "
            + "and (:semGrupos = true or c.grupo in :grupos) order by c.nome")
    Page<CatalogoAlimento> buscar(String padrao, boolean semGrupos, Collection<String> grupos, Pageable pagina);

    @Query("select distinct c.grupo from CatalogoAlimento c where c.grupo is not null order by c.grupo")
    List<String> grupos();
}
