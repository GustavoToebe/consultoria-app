package br.com.treinos.api.auditoria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.Instant;
import java.util.UUID;
public interface AuditoriaRepository extends JpaRepository<RegistroAuditoria,UUID> {
    @Query("select a from RegistroAuditoria a where a.criadoEm>=:de and a.criadoEm<:ate and (:usuarioId is null or a.usuarioId=:usuarioId) and (:acao is null or a.acao=:acao) order by a.criadoEm desc,a.id desc")
    Page<RegistroAuditoria> buscar(Instant de,Instant ate,UUID usuarioId,String acao,Pageable pagina);
}
