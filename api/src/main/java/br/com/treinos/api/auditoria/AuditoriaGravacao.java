package br.com.treinos.api.auditoria;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
/** SQL mínimo com tenant explícito: login abre transação global antes de conhecer a consultoria.
 * Usa a MESMA conexão transacional do service; falha da ação também desfaz a auditoria.
 */
@Component
public class AuditoriaGravacao {
    private final JdbcTemplate jdbc;
    public AuditoriaGravacao(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public void gravar(UUID cid,UUID usuarioId,String acao,String entidade,UUID entidadeId,String resumo,String ip,String userAgent) {
        if(!TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("Auditoria exige a transação da ação.");
        jdbc.update("insert into auditoria(id,consultoria_id,usuario_id,acao,entidade,entidade_id,resumo,ip,user_agent,criado_em) values (?,?,?,?,?,?,?,?,?,?)",
                UUID.randomUUID(),cid,usuarioId,acao,entidade,entidadeId,resumo,ip,userAgent,Timestamp.from(Instant.now()));
    }
    public int limpar(UUID cid,Instant antes) {
        return jdbc.update("delete from auditoria where consultoria_id=? and criado_em<?",cid,Timestamp.from(antes));
    }
}
