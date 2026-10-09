package br.com.treinos.api.pastas;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Já filtrado pela consultoria ({@code @TenantId}). */
public interface PastaRepository extends JpaRepository<PastaPlano, UUID> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from PastaPlano p where p.id = :id")
    java.util.Optional<PastaPlano> travarParaAtualizacao(UUID id);

    List<PastaPlano> findByAlunoIdOrderByCriadoEmDesc(UUID alunoId);
}
