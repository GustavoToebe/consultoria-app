package br.com.treinos.api.biblioteca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface AlimentoRepository extends JpaRepository<Alimento, UUID> {

    @Query("select a from Alimento a where a.ativo = true and lower(a.nome) like :padrao escape '\\' "
            + "order by lower(a.nome)")
    List<Alimento> buscarAtivos(String padrao);

    @Query("select count(a) > 0 from Alimento a where a.ativo = true and lower(a.nome) = :nome and a.id <> :exceto")
    boolean existeNomeAtivo(String nome, UUID exceto);

    @Query("select lower(a.nome) from Alimento a where a.ativo = true")
    List<String> nomesAtivos();
}
