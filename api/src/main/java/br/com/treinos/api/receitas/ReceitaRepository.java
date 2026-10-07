package br.com.treinos.api.receitas;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface ReceitaRepository extends JpaRepository<Receita, UUID> {

    List<Receita> findByTipoOrderByOrdemAscNomeAsc(Receita.Tipo tipo);

    List<Receita> findAllByOrderByTipoAscOrdemAscNomeAsc();

    @Query("select coalesce(max(r.ordem), 0) from Receita r where r.tipo = :tipo")
    int maiorOrdem(Receita.Tipo tipo);
}
