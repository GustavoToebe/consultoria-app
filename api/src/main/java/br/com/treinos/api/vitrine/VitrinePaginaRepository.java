package br.com.treinos.api.vitrine;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

/** A página da consultoria da sessão ({@code @TenantId}: no máximo uma linha, a da consultoria). */
public interface VitrinePaginaRepository extends JpaRepository<VitrinePagina, UUID> {

    @Query("select p from VitrinePagina p")
    Optional<VitrinePagina> daConsultoria();
}
