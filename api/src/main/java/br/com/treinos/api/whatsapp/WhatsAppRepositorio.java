package br.com.treinos.api.whatsapp;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * SQL nativo da fila dos avisos pelo WhatsApp ({@code whatsapp_envio}), permitido no {@code ArquiteturaTest}: o job reserva e
 * envia de todas as consultorias de uma vez e o webhook da Meta chega sem consultoria, então nada aqui usa {@code TenantContext}.
 * Toda escrita leva {@code consultoria_id} explícito e, depois da reserva, confere a posse ({@code reservado_por}). A única
 * consulta sem consultoria é {@link #acharPeloIdExterno}: o id da mensagem na Meta é único no banco e só quem o conhece (a Meta,
 * assinando com o app secret) o informa; ela devolve a consultoria e a escrita seguinte já a leva. Nada daqui lê ou grava texto,
 * telefone ou nome: só ids, datas, a situação e o código do erro. O que o aluno aceitou e a conexão são conferidos aqui só para
 * decidir se a linha nasce.
 */
@Component
class WhatsAppRepositorio {

    /** Um envio arrendado pelo job. */
    record Reservado(UUID id, UUID consultoriaId, UUID alunoId, TipoDeAviso tipo, UUID referenciaId, int tentativas) {
    }

    /** Onde o webhook achou a mensagem: a linha, a consultoria dela e a situação de agora. */
    record Achado(UUID id, UUID consultoriaId, String situacao) {
    }

    private final JdbcTemplate jdbc;

    WhatsAppRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Enfileira o aviso se, e só se, o aluno é ativo, não anonimizado, tem acesso e autorizou os avisos, a consultoria tem
     * conexão e modelo do tipo e (no lembrete) o aluno não desligou os lembretes. A chave única impede o aviso em dobro e faz o
     * que já existe ficar como está. Roda na transação de quem gerou o fato (mesma conexão). Devolve se nasceu uma linha.
     */
    boolean enfileirar(UUID consultoriaId, UUID alunoId, TipoDeAviso tipo, UUID referenciaId) {
        return jdbc.update("insert into whatsapp_envio (id, consultoria_id, aluno_id, tipo, referencia_id) "
                + "select ?, a.consultoria_id, a.id, ?, ? from aluno a where a.consultoria_id = ? and a.id = ? "
                + "and a.ativo and a.anonimizado_em is null and a.usuario_id is not null "
                + "and a.whatsapp_avisos_autorizado_em is not null "
                + "and (not ? or a.lembretes_cobranca_desligados_em is null) "
                + "and exists (select 1 from whatsapp_conexao c where c.consultoria_id = a.consultoria_id) "
                + "and exists (select 1 from whatsapp_modelo m where m.consultoria_id = a.consultoria_id and m.tipo = ?) "
                + "on conflict (consultoria_id, tipo, referencia_id, aluno_id) do nothing",
                UUID.randomUUID(), tipo.name(), referenciaId, consultoriaId, alunoId, tipo.ehLembrete(), tipo.name()) > 0;
    }

    /** Arrenda um lote de pendentes vencidos num comando só ({@code skip locked}); quem não concluir devolve à fila sozinho. */
    List<Reservado> reservar(UUID dono, int limite, int segundos) {
        return jdbc.query("update whatsapp_envio w set reservado_por = ?, reserva_ate = now() + make_interval(secs => ?) "
                + "where w.id in (select id from whatsapp_envio where situacao = 'PENDENTE' and proxima_tentativa <= now() "
                + "and (reservado_por is null or reserva_ate < now()) order by proxima_tentativa limit ? for update skip locked) "
                + "returning w.id, w.consultoria_id, w.aluno_id, w.tipo, w.referencia_id, w.tentativas",
                (rs, n) -> new Reservado(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                        TipoDeAviso.valueOf(rs.getString(4)), rs.getObject(5, UUID.class), rs.getInt(6)),
                dono, (double) segundos, limite);
    }

    /** A Meta aceitou: guarda o id da mensagem, pelo qual o webhook acha a linha. */
    void enviado(UUID consultoriaId, UUID id, UUID dono, String idExterno) {
        jdbc.update("update whatsapp_envio set situacao = 'ENVIADO', tentativas = tentativas + 1, enviado_em = now(), "
                + "id_externo = ?, codigo_erro = null, atualizado_em = now(), reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ? and situacao = 'PENDENTE' and reservado_por = ?",
                idExterno, id, consultoriaId, dono);
    }

    void cancelar(UUID consultoriaId, UUID id, UUID dono, String motivo) {
        jdbc.update("update whatsapp_envio set situacao = 'CANCELADO', motivo = ?, atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ? and situacao = 'PENDENTE' and reservado_por = ?",
                motivo, id, consultoriaId, dono);
    }

    /**
     * O envio falhou: conta a tentativa e guarda só o código (da Meta ou a classe do erro). Na {@code maximo}-ésima vira
     * FALHOU; antes, volta à fila daqui a {@code segundos}.
     */
    void falhou(UUID consultoriaId, UUID id, UUID dono, String codigo, int maximo, long segundos) {
        jdbc.update("update whatsapp_envio set tentativas = tentativas + 1, codigo_erro = ?, "
                + "situacao = case when tentativas + 1 >= ? then 'FALHOU' else 'PENDENTE' end, "
                + "proxima_tentativa = now() + make_interval(secs => ?), atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ? and situacao = 'PENDENTE' and reservado_por = ?",
                codigo, maximo, (double) segundos, id, consultoriaId, dono);
    }

    /** O aluno deixou de autorizar, foi anonimizado ou excluiu a conta: o que ainda não saiu não sai mais. Devolve quantos. */
    int cancelarPendentesDoAluno(UUID consultoriaId, UUID alunoId, String motivo) {
        return jdbc.update("update whatsapp_envio set situacao = 'CANCELADO', motivo = ?, atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null "
                + "where consultoria_id = ? and aluno_id = ? and situacao = 'PENDENTE'", motivo, consultoriaId, alunoId);
    }

    /** A conexão da consultoria foi apagada: nenhum pendente dela tem mais por onde sair. Devolve quantos. */
    int cancelarPendentesDaConsultoria(UUID consultoriaId, String motivo) {
        return jdbc.update("update whatsapp_envio set situacao = 'CANCELADO', motivo = ?, atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null where consultoria_id = ? and situacao = 'PENDENTE'",
                motivo, consultoriaId);
    }

    /** Onde está a mensagem com esse id da Meta, se é nossa. Única consulta sem consultoria daqui (ver a classe). */
    Optional<Achado> acharPeloIdExterno(String idExterno) {
        return jdbc.query("select id, consultoria_id, situacao from whatsapp_envio where id_externo = ?",
                (rs, n) -> new Achado(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3)), idExterno)
                .stream().findFirst();
    }

    /**
     * O que o webhook diz que aconteceu, só para frente (ENVIADO → ENTREGUE → LIDO; FALHOU só de quem ainda está em ENVIADO).
     * A situação de agora faz parte do {@code where}: se a linha já avançou (ou o aviso chegou fora de ordem), nada muda.
     */
    void entregue(UUID consultoriaId, UUID id) {
        jdbc.update("update whatsapp_envio set situacao = 'ENTREGUE', entregue_em = now(), atualizado_em = now() "
                + "where id = ? and consultoria_id = ? and situacao = 'ENVIADO'", id, consultoriaId);
    }

    void lido(UUID consultoriaId, UUID id) {
        jdbc.update("update whatsapp_envio set situacao = 'LIDO', lido_em = now(), "
                + "entregue_em = coalesce(entregue_em, now()), atualizado_em = now() "
                + "where id = ? and consultoria_id = ? and situacao in ('ENVIADO', 'ENTREGUE')", id, consultoriaId);
    }

    void falhouDepoisDeEnviado(UUID consultoriaId, UUID id, String codigo) {
        jdbc.update("update whatsapp_envio set situacao = 'FALHOU', codigo_erro = ?, atualizado_em = now() "
                + "where id = ? and consultoria_id = ? and situacao = 'ENVIADO'", codigo, id, consultoriaId);
    }

    /**
     * Limpeza global: pendente velho demais não faz mais sentido ("seu compromisso foi marcado" dias depois) e vira CANCELADO
     * ({@code EXPIRADO}); o histórico some {@code diasDeHistorico} dias depois da última mudança.
     */
    void limpar(int horasDePendente, int diasDeHistorico) {
        jdbc.update("update whatsapp_envio set situacao = 'CANCELADO', motivo = 'EXPIRADO', atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null where situacao = 'PENDENTE' "
                + "and criado_em < now() - make_interval(hours => ?) and (reservado_por is null or reserva_ate < now())",
                horasDePendente);
        jdbc.update("delete from whatsapp_envio where situacao <> 'PENDENTE' and atualizado_em < now() - make_interval(days => ?)",
                diasDeHistorico);
    }
}
