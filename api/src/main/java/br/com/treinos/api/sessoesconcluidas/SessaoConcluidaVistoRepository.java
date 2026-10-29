package br.com.treinos.api.sessoesconcluidas;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Os "Visto" do treinador. Já filtrados pela consultoria ({@code @TenantId}). */
public interface SessaoConcluidaVistoRepository extends JpaRepository<SessaoConcluidaVisto, UUID> {

    List<SessaoConcluidaVisto> findBySessaoConcluidaIdIn(Collection<UUID> sessaoConcluidaIds);
}
