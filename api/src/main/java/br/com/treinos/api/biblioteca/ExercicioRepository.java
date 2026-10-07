package br.com.treinos.api.biblioteca;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface ExercicioRepository extends JpaRepository<Exercicio, UUID> {

    @Query("select e from Exercicio e where e.ativo = true and lower(e.nome) like :padrao escape '\\' "
            + "order by lower(e.nome)")
    List<Exercicio> buscarAtivos(String padrao);

    @Query("select count(e) > 0 from Exercicio e where e.ativo = true and lower(e.nome) = :nome and e.id <> :exceto")
    boolean existeNomeAtivo(String nome, UUID exceto);

    @Query("select lower(e.nome) from Exercicio e where e.ativo = true")
    List<String> nomesAtivos();

    List<Exercicio> findByIdIn(Collection<UUID> ids);
}
