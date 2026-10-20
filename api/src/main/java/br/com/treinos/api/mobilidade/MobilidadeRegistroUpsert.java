package br.com.treinos.api.mobilidade;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gravação idempotente do registro de mobilidade do aluno. SQL nativo permitido no {@code ArquiteturaTest}: o
 * {@code @TenantId} não protege SQL nativo, então consultoria e aluno vão sempre explícitos, vindos da sessão.
 *
 * <p>Upsert pela chave {@code (aluno, versão, item, dia)}: o mesmo registro reenviado não duplica, e desmarcar é o mesmo
 * registro com {@code feito = false}. Só atualiza se o {@code alterado_no_aparelho_em} recebido for mais novo (o aparelho é
 * o único autor), como o {@code ExecucaoUpsert} das séries.</p>
 *
 * <p>Não público: só o pacote {@code mobilidade} usa.</p>
 */
@Component
class MobilidadeRegistroUpsert {

    record Chave(UUID alunoId, UUID planoVersaoId, UUID itemUid, LocalDate data) {
    }

    record Linha(UUID id, UUID consultoriaId, UUID alunoId, UUID planoVersaoId, UUID secaoUid, UUID itemUid,
                 LocalDate data, boolean feito, String situacao, String motivo, Instant alteradoNoAparelhoEm) {
    }

    private static final String SQL = """
            insert into mobilidade_registro (id, consultoria_id, aluno_id, plano_versao_id, secao_uid, item_uid, data,
              feito, situacao, motivo, alterado_no_aparelho_em)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict (aluno_id, plano_versao_id, item_uid, data) do update set
              feito = excluded.feito,
              situacao = excluded.situacao,
              motivo = excluded.motivo,
              alterado_no_aparelho_em = excluded.alterado_no_aparelho_em,
              atualizado_em = now()
            where excluded.alterado_no_aparelho_em > mobilidade_registro.alterado_no_aparelho_em
              and mobilidade_registro.consultoria_id = excluded.consultoria_id
            returning id
            """;

    private final JdbcTemplate jdbc;

    MobilidadeRegistroUpsert(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** {@code true} se gravou ou atualizou (o registro recebido era o mais recente); {@code false} se era antigo. */
    boolean gravar(Linha l) {
        List<UUID> gravados = jdbc.query(SQL, (rs, n) -> rs.getObject(1, UUID.class),
                l.id(), l.consultoriaId(), l.alunoId(), l.planoVersaoId(), l.secaoUid(), l.itemUid(), l.data(),
                l.feito(), l.situacao(), l.motivo(), Timestamp.from(l.alteradoNoAparelhoEm()));
        return !gravados.isEmpty();
    }

    /**
     * Ids do lote que já existem no banco, com a chave de cada um (em qualquer consultoria: um id gerado no aparelho
     * que colide com registro de outro aluno precisa ser recusado, não sobrescrito). Só devolve a chave para comparar.
     */
    Map<UUID, Chave> existentes(Collection<UUID> ids) {
        Map<UUID, Chave> mapa = new HashMap<>();
        if (ids.isEmpty()) {
            return mapa;
        }
        jdbc.query("select id, aluno_id, plano_versao_id, item_uid, data from mobilidade_registro where id = any(?)",
                ps -> ps.setArray(1, ps.getConnection().createArrayOf("uuid", ids.toArray())),
                rs -> {
                    mapa.put(rs.getObject(1, UUID.class), new Chave(rs.getObject(2, UUID.class),
                            rs.getObject(3, UUID.class), rs.getObject(4, UUID.class),
                            rs.getObject(5, LocalDate.class)));
                });
        return mapa;
    }
}
