package br.com.treinos.api.planos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Versões publicadas (treino ou dieta). Já filtradas pela consultoria ({@code @TenantId}). */
@NoRepositoryBean
public interface VersaoRepositorio<V extends VersaoBase> extends JpaRepository<V, UUID> {

    List<V> findByPlanoIdOrderByNumeroAsc(UUID planoId);

    Optional<V> findByPlanoIdAndNumero(UUID planoId, int numero);

    List<V> findByIdIn(Collection<UUID> ids);
}
