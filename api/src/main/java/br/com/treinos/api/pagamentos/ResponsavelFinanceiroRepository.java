package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/** Filtrado pela consultoria da sessão ({@code @TenantId}); no máximo uma linha por aluno. */
public interface ResponsavelFinanceiroRepository extends JpaRepository<ResponsavelFinanceiro, UUID> {

    Optional<ResponsavelFinanceiro> findByAlunoId(UUID alunoId);
}
