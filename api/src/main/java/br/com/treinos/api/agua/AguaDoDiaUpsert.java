package br.com.treinos.api.agua;

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
 * Gravação idempotente da água do dia. SQL nativo permitido no {@code ArquiteturaTest}: o {@code @TenantId} não protege SQL
 * nativo, então consultoria e aluno vão sempre explícitos, vindos da sessão.
 *
 * <p>Upsert pela chave {@code (aluno, dia)}: o mesmo registro reenviado não duplica, e tirar um copo é o mesmo registro com
 * menos mililitros. Só atualiza se o {@code alterado_no_aparelho_em} recebido for mais novo (o aparelho é o único autor),
 * como o {@code MobilidadeRegistroUpsert}. Também apaga as linhas do aluno na anonimização (a entidade é imutável).</p>
 *
 * <p>Não público: só o pacote {@code agua} usa.</p>
 */
@Component
class AguaDoDiaUpsert {

    record Chave(UUID alunoId, LocalDate data) {
    }

    private static final String SQL = """
            insert into agua_do_dia (id, consultoria_id, aluno_id, data, agua_ml, alterado_no_aparelho_em)
            values (?, ?, ?, ?, ?, ?)
            on conflict (aluno_id, data) do update set
              agua_ml = excluded.agua_ml,
              alterado_no_aparelho_em = excluded.alterado_no_aparelho_em,
              atualizado_em = now()
            where excluded.alterado_no_aparelho_em > agua_do_dia.alterado_no_aparelho_em
              and agua_do_dia.consultoria_id = excluded.consultoria_id
            returning id
            """;

    private final JdbcTemplate jdbc;

    AguaDoDiaUpsert(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** {@code true} se gravou ou atualizou (o registro recebido era o mais recente); {@code false} se era antigo. */
    boolean gravar(UUID id, UUID consultoriaId, UUID alunoId, LocalDate data, int aguaMl, Instant alteradoNoAparelhoEm) {
        List<UUID> gravados = jdbc.query(SQL, (rs, n) -> rs.getObject(1, UUID.class),
                id, consultoriaId, alunoId, data, aguaMl, Timestamp.from(alteradoNoAparelhoEm));
        return !gravados.isEmpty();
    }

    /**
     * Ids do lote que já existem no banco, com a chave de cada um (em qualquer consultoria: um id gerado no aparelho que
     * colide com registro de outro aluno precisa ser recusado, não sobrescrito). Só devolve a chave para comparar.
     */
    Map<UUID, Chave> existentes(Collection<UUID> ids) {
        Map<UUID, Chave> mapa = new HashMap<>();
        if (ids.isEmpty()) {
            return mapa;
        }
        jdbc.query("select id, aluno_id, data from agua_do_dia where id = any(?)",
                ps -> ps.setArray(1, ps.getConnection().createArrayOf("uuid", ids.toArray())),
                rs -> {
                    mapa.put(rs.getObject(1, UUID.class),
                            new Chave(rs.getObject(2, UUID.class), rs.getObject(3, LocalDate.class)));
                });
        return mapa;
    }

    /** Anonimização e "Excluir minha conta": a água é dado de dieta e sai inteira. */
    void apagarDoAluno(UUID consultoriaId, UUID alunoId) {
        jdbc.update("delete from agua_do_dia where consultoria_id = ? and aluno_id = ?", consultoriaId, alunoId);
    }
}
