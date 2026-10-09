package br.com.treinos.api.execucao;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gravação idempotente do registro do aluno (seção 9.4). SQL nativo permitido no {@code ArquiteturaTest}: o
 * {@code @TenantId} não protege SQL nativo, então consultoria e aluno vão sempre explícitos, vindos da sessão.
 *
 * <p>Upsert pela chave {@code (aluno, versão, série, dia)}: mesmo registro reenviado não duplica; só atualiza se o
 * {@code alterado_no_aparelho_em} recebido for mais novo (o aparelho é o único autor).</p>
 *
 * <p>Público só para o {@code SeedHistoricoDemo} (dados de demonstração com datas passadas, que a API recusa); nenhuma rota usa.</p>
 */
@Component
public class ExecucaoUpsert {

    record Chave(UUID alunoId, UUID planoVersaoId, UUID serieUid, LocalDate data) {
    }

    public record Linha(UUID id, UUID consultoriaId, UUID alunoId, UUID planoVersaoId, UUID sessaoUid, UUID exercicioUid,
                 UUID serieUid, UUID exercicioId, boolean serieTrabalho, LocalDate data, BigDecimal carga,
                 String unidade, Integer repeticoes, boolean concluida, String observacao,
                 Instant alteradoNoAparelhoEm) {
    }

    private static final String SQL = """
            insert into execucao_serie (id, consultoria_id, aluno_id, plano_versao_id, sessao_uid, exercicio_uid,
              serie_uid, exercicio_id, serie_trabalho, data, carga, unidade, repeticoes, concluida, observacao,
              alterado_no_aparelho_em)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict (aluno_id, plano_versao_id, serie_uid, data) do update set
              carga = excluded.carga,
              unidade = excluded.unidade,
              repeticoes = excluded.repeticoes,
              concluida = excluded.concluida,
              observacao = excluded.observacao,
              alterado_no_aparelho_em = excluded.alterado_no_aparelho_em,
              recebido_em = now()
            where excluded.alterado_no_aparelho_em > execucao_serie.alterado_no_aparelho_em
              and execucao_serie.consultoria_id = excluded.consultoria_id
            returning id
            """;

    private final JdbcTemplate jdbc;

    ExecucaoUpsert(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** @return {@code true} se gravou (novo ou mais recente); {@code false} se o registro recebido era antigo. */
    public boolean gravar(Linha l) {
        List<UUID> gravados = jdbc.query(SQL, (rs, n) -> rs.getObject(1, UUID.class),
                l.id(), l.consultoriaId(), l.alunoId(), l.planoVersaoId(), l.sessaoUid(), l.exercicioUid(),
                l.serieUid(), l.exercicioId(), l.serieTrabalho(), l.data(), l.carga(), l.unidade(), l.repeticoes(),
                l.concluida(), l.observacao(), Timestamp.from(l.alteradoNoAparelhoEm()));
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
        jdbc.query("select id, aluno_id, plano_versao_id, serie_uid, data from execucao_serie where id = any(?)",
                ps -> ps.setArray(1, ps.getConnection().createArrayOf("uuid", ids.toArray())),
                rs -> {
                    mapa.put(rs.getObject(1, UUID.class), new Chave(rs.getObject(2, UUID.class),
                            rs.getObject(3, UUID.class), rs.getObject(4, UUID.class),
                            rs.getObject(5, LocalDate.class)));
                });
        return mapa;
    }
}
