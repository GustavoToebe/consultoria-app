package br.com.treinos.api.pagamentos;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * SQL nativo da fila dos lembretes de cobrança ({@code lembrete_cobranca}), permitido no {@code ArquiteturaTest}: o job
 * planeja e reserva de todas as consultorias de uma vez, sem {@code TenantContext}. Cada escrita leva {@code consultoria_id}
 * explícito e, depois da reserva, confere a posse ({@code reservado_por}): resultado de quem perdeu a reserva não muda nada.
 * Nada daqui lê ou grava endereço, nome ou texto: só ids, datas, a configuração e o andamento.
 */
@Component
class LembretesRepositorio {

    /** Uma cobrança aberta de consultoria com os lembretes ligados, com a configuração dela (candidata a lembrete hoje). */
    record Candidata(UUID consultoriaId, UUID cobrancaId, LocalDate vencimento, RegraDosLembretes.Configuracao configuracao) {
    }

    /** Um lembrete a criar (o que a regra pura decidiu ser devido hoje). */
    record Novo(UUID consultoriaId, UUID cobrancaId, TipoDeLembrete tipo, LocalDate dataPrevista) {
    }

    /** Um lembrete arrendado pelo job. */
    record Reservado(UUID id, UUID consultoriaId, UUID cobrancaId, TipoDeLembrete tipo, int tentativas) {
    }

    private final JdbcTemplate jdbc;

    LembretesRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Cobranças ABERTAS com vencimento no intervalo, só das consultorias com os lembretes ligados. */
    List<Candidata> candidatas(LocalDate de, LocalDate ate) {
        return jdbc.query("select c.consultoria_id, c.id, c.vencimento, l.dias_antes, l.no_dia, l.dias_depois "
                + "from cobranca_aluno c join lembrete_configuracao l on l.consultoria_id = c.consultoria_id "
                + "where l.ligado and c.situacao = 'ABERTA' and c.vencimento between ? and ?",
                (rs, n) -> new Candidata(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
                        rs.getObject(3, LocalDate.class),
                        new RegraDosLembretes.Configuracao(true, rs.getInt(4), rs.getBoolean(5), rs.getInt(6))),
                Date.valueOf(de), Date.valueOf(ate));
    }

    /** Grava os lembretes novos; o que já existe para (cobrança, tipo) fica como está. Devolve quantos nasceram. */
    int planejar(List<Novo> novos) {
        if (novos.isEmpty()) {
            return 0;
        }
        int[][] resultado = jdbc.batchUpdate("insert into lembrete_cobranca (id, consultoria_id, cobranca_id, tipo, data_prevista) "
                + "values (?, ?, ?, ?, ?) on conflict (consultoria_id, cobranca_id, tipo) do nothing", novos, 200, (ps, n) -> {
                    ps.setObject(1, UUID.randomUUID());
                    ps.setObject(2, n.consultoriaId());
                    ps.setObject(3, n.cobrancaId());
                    ps.setString(4, n.tipo().name());
                    ps.setDate(5, Date.valueOf(n.dataPrevista()));
                });
        int total = 0;
        for (int[] lote : resultado) {
            for (int linhas : lote) {
                total += Math.max(linhas, 0);
            }
        }
        return total;
    }

    /** Arrenda um lote de pendentes vencidos num comando só ({@code skip locked}); quem não concluir devolve à fila sozinho. */
    List<Reservado> reservar(UUID dono, int limite, int segundos) {
        return jdbc.query("update lembrete_cobranca l set reservado_por = ?, reserva_ate = now() + make_interval(secs => ?) "
                + "where l.id in (select id from lembrete_cobranca where situacao = 'PENDENTE' and proxima_tentativa <= now() "
                + "and (reservado_por is null or reserva_ate < now()) order by proxima_tentativa limit ? for update skip locked) "
                + "returning l.id, l.consultoria_id, l.cobranca_id, l.tipo, l.tentativas",
                (rs, n) -> new Reservado(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                        TipoDeLembrete.valueOf(rs.getString(4)), rs.getInt(5)),
                dono, (double) segundos, limite);
    }

    void enviado(UUID consultoriaId, UUID id, UUID dono) {
        jdbc.update("update lembrete_cobranca set situacao = 'ENVIADO', tentativas = tentativas + 1, enviado_em = now(), "
                + "erro = null, atualizado_em = now(), reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ? and situacao = 'PENDENTE' and reservado_por = ?", id, consultoriaId, dono);
    }

    void cancelar(UUID consultoriaId, UUID id, UUID dono, String motivo) {
        jdbc.update("update lembrete_cobranca set situacao = 'CANCELADO', motivo = ?, atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ? and situacao = 'PENDENTE' and reservado_por = ?",
                motivo, id, consultoriaId, dono);
    }

    /**
     * O envio falhou: conta a tentativa e guarda só a classe do erro. Na {@code maximo}-ésima vira FALHOU; antes, volta à fila
     * daqui a {@code segundos}.
     */
    void falhou(UUID consultoriaId, UUID id, UUID dono, String classeDoErro, int maximo, long segundos) {
        jdbc.update("update lembrete_cobranca set tentativas = tentativas + 1, erro = ?, "
                + "situacao = case when tentativas + 1 >= ? then 'FALHOU' else 'PENDENTE' end, "
                + "proxima_tentativa = now() + make_interval(secs => ?), atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ? and situacao = 'PENDENTE' and reservado_por = ?",
                classeDoErro, maximo, (double) segundos, id, consultoriaId, dono);
    }

    /** E-mail do app desligado: nenhum pendente fica esperando um envio que não vai acontecer. Global. Devolve quantos. */
    int cancelarPendentes(String motivo) {
        return jdbc.update("update lembrete_cobranca set situacao = 'CANCELADO', motivo = ?, atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null where situacao = 'PENDENTE' "
                + "and (reservado_por is null or reserva_ate < now())", motivo);
    }
}
