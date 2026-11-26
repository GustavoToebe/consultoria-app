package br.com.treinos.api.contratos;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Os PDFs dos contratos da consultoria da sessão ({@code @TenantId}); a chave é o id do contrato. */
public interface ContratoArquivoRepository extends JpaRepository<ContratoArquivo, UUID> {
}
