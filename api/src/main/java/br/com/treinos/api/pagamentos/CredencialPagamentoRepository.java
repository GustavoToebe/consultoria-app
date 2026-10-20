package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface CredencialPagamentoRepository extends JpaRepository<CredencialPagamento, UUID> {

    Optional<CredencialPagamento> findByProvedor(String provedor);

    boolean existsByProvedor(String provedor);
}
