package br.com.treinos.api.agenda;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Exceções das séries. Leitura filtrada pelo {@code @TenantId}; o serviço só chega aqui por um evento do dono. */
public interface ExcecaoDeEventoRepository extends JpaRepository<ExcecaoDeEvento, UUID> {

    List<ExcecaoDeEvento> findByEventoId(UUID eventoId);

    List<ExcecaoDeEvento> findByEventoIdIn(Collection<UUID> eventoIds);

    Optional<ExcecaoDeEvento> findByEventoIdAndDataOriginal(UUID eventoId, LocalDate dataOriginal);
}
