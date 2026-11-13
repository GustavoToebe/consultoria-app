package br.com.treinos.api.comunidade;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Métodos derivados: o {@code @TenantId} vale em todos (opção de outra consultoria não aparece). */
public interface ComunidadeEnqueteOpcaoRepository extends JpaRepository<ComunidadeEnqueteOpcao, UUID> {

    List<ComunidadeEnqueteOpcao> findByPostIdInOrderByPostIdAscOrdemAsc(Collection<UUID> postIds);

    List<ComunidadeEnqueteOpcao> findByPostIdOrderByOrdemAsc(UUID postId);
}
