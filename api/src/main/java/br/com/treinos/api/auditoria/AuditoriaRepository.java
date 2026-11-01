package br.com.treinos.api.auditoria;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.Instant;
import java.util.Collection;
import java.util.UUID;
public interface AuditoriaRepository extends JpaRepository<RegistroAuditoria,UUID> {
    /** {@code filtraUsuarios}: só os autores de {@code usuarios} e, com {@code sistema}, os eventos sem autor; {@code filtraAcoes}: só as {@code acoes}. */
    @Query("select a from RegistroAuditoria a where a.criadoEm>=:de and a.criadoEm<:ate "
            + "and (:filtraUsuarios=false or a.usuarioId in :usuarios or (:sistema=true and a.usuarioId is null)) "
            + "and (:filtraAcoes=false or a.acao in :acoes) order by a.criadoEm desc,a.id desc")
    Page<RegistroAuditoria> buscar(Instant de,Instant ate,boolean filtraUsuarios,Collection<UUID> usuarios,boolean sistema,
                                   boolean filtraAcoes,Collection<String> acoes,Pageable pagina);
}
