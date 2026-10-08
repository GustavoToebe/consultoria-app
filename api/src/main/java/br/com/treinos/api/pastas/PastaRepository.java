package br.com.treinos.api.pastas;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}). */
public interface PastaRepository extends JpaRepository<PastaPlano, UUID> {

    List<PastaPlano> findByAlunoIdOrderByCriadoEmDesc(UUID alunoId);
}
