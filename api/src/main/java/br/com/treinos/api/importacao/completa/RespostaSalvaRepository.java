package br.com.treinos.api.importacao.completa;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Já filtrado pela consultoria da sessão ({@code @TenantId}). */
public interface RespostaSalvaRepository extends JpaRepository<RespostaSalva, UUID> {
}
