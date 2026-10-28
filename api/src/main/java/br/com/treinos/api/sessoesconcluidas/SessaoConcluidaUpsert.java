package br.com.treinos.api.sessoesconcluidas;

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
 * Gravação idempotente da sessão concluída pelo aluno. SQL nativo permitido no {@code ArquiteturaTest}: o
 * {@code @TenantId} não protege SQL nativo, então consultoria e aluno vão sempre explícitos, vindos da sessão.
 *
 * <p>Upsert pela chave {@code (aluno, versão, sessão, dia)}: o mesmo registro reenviado não duplica, e reabrir é o mesmo
 * registro com {@code concluida = false}. Só atualiza se o {@code alterado_no_aparelho_em} recebido for mais novo (o
 * aparelho é o único autor), como o {@code MobilidadeRegistroUpsert}. Nada aqui entra em log: o comentário é sensível.</p>
 *
 * <p>Não público: só o pacote {@code sessoesconcluidas} usa.</p>
 */
@Component
class SessaoConcluidaUpsert {

    record Chave(UUID alunoId, UUID planoVersaoId, UUID sessaoUid, LocalDate data) {
    }

    /** O {@code toString} deixa o comentário de fora: records imprimem todos os campos. */
    record Linha(UUID id, UUID consultoriaId, UUID alunoId, UUID planoVersaoId, UUID sessaoUid, LocalDate data,
                 boolean concluida, String resultado, Integer duracaoSegundos, String comentario, String situacao,
                 String motivo, Instant alteradoNoAparelhoEm) {
        @Override
        public String toString() {
            return "Linha[id=" + id + "]";
        }
    }

    private static final String SQL = """
            insert into sessao_concluida (id, consultoria_id, aluno_id, plano_versao_id, sessao_uid, data, concluida,
              resultado, duracao_segundos, comentario, situacao, motivo, alterado_no_aparelho_em)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict (aluno_id, plano_versao_id, sessao_uid, data) do update set
              concluida = excluded.concluida,
              resultado = excluded.resultado,
              duracao_segundos = excluded.duracao_segundos,
              comentario = excluded.comentario,
              situacao = excluded.situacao,
              motivo = excluded.motivo,
              alterado_no_aparelho_em = excluded.alterado_no_aparelho_em,
              atualizado_em = now()
            where excluded.alterado_no_aparelho_em > sessao_concluida.alterado_no_aparelho_em
              and sessao_concluida.consultoria_id = excluded.consultoria_id
            returning id
            """;

    private final JdbcTemplate jdbc;

    SessaoConcluidaUpsert(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** {@code true} se gravou ou atualizou (o registro recebido era o mais recente); {@code false} se era antigo. */
    boolean gravar(Linha l) {
        List<UUID> gravados = jdbc.query(SQL, (rs, n) -> rs.getObject(1, UUID.class),
                l.id(), l.consultoriaId(), l.alunoId(), l.planoVersaoId(), l.sessaoUid(), l.data(), l.concluida(),
                l.resultado(), l.duracaoSegundos(), l.comentario(), l.situacao(), l.motivo(),
                Timestamp.from(l.alteradoNoAparelhoEm()));
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
        jdbc.query("select id, aluno_id, plano_versao_id, sessao_uid, data from sessao_concluida where id = any(?)",
                ps -> ps.setArray(1, ps.getConnection().createArrayOf("uuid", ids.toArray())),
                rs -> {
                    mapa.put(rs.getObject(1, UUID.class), new Chave(rs.getObject(2, UUID.class),
                            rs.getObject(3, UUID.class), rs.getObject(4, UUID.class),
                            rs.getObject(5, LocalDate.class)));
                });
        return mapa;
    }
}
