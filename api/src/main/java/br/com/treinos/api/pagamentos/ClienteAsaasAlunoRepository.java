package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

/** Filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface ClienteAsaasAlunoRepository extends JpaRepository<ClienteAsaasAluno, UUID> {

    Optional<ClienteAsaasAluno> findByAlunoIdAndSubcontaId(UUID alunoId, UUID subcontaId);

    void deleteByAlunoId(UUID alunoId);
}
