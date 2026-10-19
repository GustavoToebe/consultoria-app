package br.com.treinos.api.alunos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface FotoPerfilRepository extends JpaRepository<FotoPerfil, UUID> {

    /** Só a data, sem carregar os bytes (exportação). */
    @Query("select f.atualizadaEm from FotoPerfil f where f.alunoId = :alunoId")
    Optional<Instant> atualizadaEm(UUID alunoId);
}
