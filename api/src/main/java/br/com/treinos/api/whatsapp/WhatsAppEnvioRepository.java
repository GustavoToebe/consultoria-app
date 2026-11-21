package br.com.treinos.api.whatsapp;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Só leitura (a exportação do aluno); filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface WhatsAppEnvioRepository extends JpaRepository<WhatsAppEnvio, UUID> {

    List<WhatsAppEnvio> findByAlunoIdOrderByCriadoEmAscIdAsc(UUID alunoId);
}
