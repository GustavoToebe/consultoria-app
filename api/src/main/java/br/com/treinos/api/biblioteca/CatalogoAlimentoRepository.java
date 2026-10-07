package br.com.treinos.api.biblioteca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface CatalogoAlimentoRepository extends JpaRepository<CatalogoAlimento, UUID> {

    @Query("select c from CatalogoAlimento c where lower(c.nome) like :padrao escape '\\' order by c.nome")
    List<CatalogoAlimento> buscar(String padrao);
}
