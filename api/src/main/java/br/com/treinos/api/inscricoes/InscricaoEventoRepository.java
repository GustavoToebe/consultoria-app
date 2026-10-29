package br.com.treinos.api.inscricoes;

import br.com.treinos.api.inscricoes.Crm.TipoEvento;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Eventos da consultoria da sessão ({@code @TenantId}). */
public interface InscricaoEventoRepository extends JpaRepository<InscricaoEvento, UUID> {

    /** Os mais recentes primeiro (o detalhe mostra até o limite pedido). */
    List<InscricaoEvento> findByInscricaoIdOrderByCriadoEmDesc(UUID inscricaoId, Pageable limite);

    /** Contagem por tipo, para (situação/encerramento) e motivo no período (indicadores). */
    record PorChave(String para, String motivo, long quantidade) {
    }

    @Query("select new br.com.treinos.api.inscricoes.InscricaoEventoRepository$PorChave(e.para, e.motivo, count(e)) "
            + "from InscricaoEvento e where e.tipo = :tipo and e.criadoEm >= :inicio and e.criadoEm < :fim "
            + "group by e.para, e.motivo")
    List<PorChave> contarNoPeriodo(TipoEvento tipo, Instant inicio, Instant fim);
}
