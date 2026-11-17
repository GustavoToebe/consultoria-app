package br.com.treinos.api.comunidade;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Todos os métodos saem filtrados pela consultoria da sessão ({@code @TenantId}): pod de outra consultoria não existe. */
public interface ComunidadePodRepository extends JpaRepository<ComunidadePod, UUID> {

    List<ComunidadePod> findAllByOrderByNomeAscIdAsc();

    /** Trava a linha do pod até o fim da transação: serializa quem entra no mesmo pod, para o teto de membros não furar. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ComunidadePod p where p.id = :id")
    Optional<ComunidadePod> travar(UUID id);
}
