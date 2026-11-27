package br.com.treinos.api.pagamentos;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * SQL nativo da fila durável de cancelamento no Asaas ({@code cancelamento_asaas_pendente}), permitido no
 * {@code ArquiteturaTest}: a varredura do worker é global, sem tenant; toda escrita leva {@code consultoria_id} ou o id da
 * linha reservada. Guarda só ids (cobrança nossa e cobrança do Asaas), nunca valor, nome nem segredo.
 */
@Component
class FilaDeCancelamentoAsaas {

    record Pendente(UUID id, UUID consultoriaId, String asaasCobrancaId, int tentativas) {
        @Override
        public String toString() {
            return "Pendente[...]";
        }
    }

    private final JdbcTemplate jdbc;

    FilaDeCancelamentoAsaas(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Roda na transação de quem chama: a linha nasce e morre junto com a operação do treinador. Repetir o id não duplica. */
    void enfileirar(UUID consultoriaId, UUID cobrancaId, String asaasCobrancaId) {
        jdbc.update("insert into cancelamento_asaas_pendente (id, consultoria_id, cobranca_id, asaas_cobranca_id) "
                + "values (?, ?, ?, ?) on conflict (consultoria_id, asaas_cobranca_id) do nothing",
                UUID.randomUUID(), consultoriaId, cobrancaId, asaasCobrancaId);
    }

    /** Arrenda até {@code limite} pedidos vencidos (a próxima tentativa vai {@code reservaEmSegundos} para frente). */
    List<Pendente> reservar(int limite, int reservaEmSegundos) {
        return jdbc.query("update cancelamento_asaas_pendente set proxima_tentativa = now() + ? * interval '1 second' "
                + "where id in (select id from cancelamento_asaas_pendente where situacao = 'PENDENTE' "
                + "and proxima_tentativa <= now() order by proxima_tentativa limit ? for update skip locked) "
                + "returning id, consultoria_id, asaas_cobranca_id, tentativas",
                (rs, n) -> new Pendente(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3),
                        rs.getInt(4)),
                reservaEmSegundos, limite);
    }

    void concluir(UUID id) {
        jdbc.update("delete from cancelamento_asaas_pendente where id = ?", id);
    }

    void reagendar(UUID id, long esperaEmSegundos) {
        jdbc.update("update cancelamento_asaas_pendente set tentativas = tentativas + 1, "
                + "proxima_tentativa = now() + ? * interval '1 second' where id = ?", esperaEmSegundos, id);
    }

    /** Sem nova tentativa (o Asaas recusou, a subconta saiu ou o teto de tentativas acabou); a linha fica para quem investigar. */
    void falhou(UUID id) {
        jdbc.update("update cancelamento_asaas_pendente set situacao = 'FALHOU', tentativas = tentativas + 1 where id = ?", id);
    }
}
