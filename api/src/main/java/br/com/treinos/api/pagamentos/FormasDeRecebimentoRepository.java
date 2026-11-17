package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

/** Filtrado pela consultoria da sessão ({@code @TenantId}): no máximo uma linha. */
public interface FormasDeRecebimentoRepository extends JpaRepository<FormasDeRecebimento, UUID> {

    @Query("select f from FormasDeRecebimento f")
    Optional<FormasDeRecebimento> daConsultoria();
}
