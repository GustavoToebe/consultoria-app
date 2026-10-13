package br.com.treinos.api.integracao;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * SQL da integração com a Central. As tabelas são globais e a integração roda fora do contexto de qualquer consultoria,
 * então toda consulta filtra {@code consultoria_id} explicitamente (nada vem de {@code TenantContext}). É a única classe
 * da integração com SQL nativo (liberada no {@code ArquiteturaTest}). O perfil Administrador de uma consultoria tem id
 * determinístico ({@code md5(consultoria_id || ':Administrador')}, migration V018).
 */
@Component
public class IntegracaoRepositorio {

    public record Operacao(String hashCorpo, int statusHttp, String resposta) { }

    public record TreinadorExistente(UUID usuarioId, UUID consultoriaId, boolean administrador, boolean ativo) { }

    public record ConsultoriaResumo(String nome, String slug) { }

    public record ConviteDoAdministrador(UUID id, String nome, String email) { }

    private final JdbcTemplate jdbc;

    public IntegracaoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // --- nonce -----------------------------------------------------------------------------------------------------

    /** {@code false} = já existia (repetição). */
    public boolean registrarNonce(String chaveId, String nonce) {
        return jdbc.update("insert into integracao_nonce(chave_id, nonce) values (?, ?) on conflict do nothing",
                chaveId, nonce) == 1;
    }

    public int limparNonces(Instant antes) {
        return jdbc.update("delete from integracao_nonce where recebido_em < ?", Timestamp.from(antes));
    }

    // --- operações idempotentes --------------------------------------------------------------------------------------

    public Optional<Operacao> operacao(UUID chave) {
        return jdbc.query("select hash_corpo, status_http, resposta::text from integracao_operacao where idempotency_key = ?",
                (rs, n) -> new Operacao(rs.getString(1), rs.getInt(2), rs.getString(3)), chave).stream().findFirst();
    }

    public void gravarOperacao(UUID chave, String tipo, String hashCorpo, int statusHttp, String respostaJson) {
        jdbc.update("insert into integracao_operacao(idempotency_key, tipo, hash_corpo, status_http, resposta) "
                + "values (?, ?, ?, ?, ?::jsonb)", chave, tipo, hashCorpo, statusHttp, respostaJson);
    }

    // --- consultoria e usuário -------------------------------------------------------------------------------------

    public Optional<ConsultoriaResumo> consultoria(UUID id) {
        return jdbc.query("select nome, slug from consultoria where id = ?",
                (rs, n) -> new ConsultoriaResumo(rs.getString(1), rs.getString(2)), id).stream().findFirst();
    }

    /**
     * {@code email} já normalizado (minúsculas). Procura qualquer usuário: o e-mail é único no sistema todo, então o de um
     * aluno também ocupa o lugar e não pode ganhar uma consultoria nova. Quem não é administrador volta com
     * {@code administrador=false}.
     */
    public Optional<TreinadorExistente> treinadorPorEmail(String email) {
        return jdbc.query("select u.id, u.consultoria_id, coalesce(p.acesso_total, false) and u.papel = 'TREINADOR', u.ativo from usuario u "
                        + "left join perfil p on p.consultoria_id = u.consultoria_id and p.id = u.perfil_id "
                        + "where lower(u.email) = ?",
                (rs, n) -> new TreinadorExistente(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
                        rs.getBoolean(3), rs.getBoolean(4)), email).stream().findFirst();
    }

    public long alunosAtivos(UUID consultoriaId) {
        Long total = jdbc.queryForObject("select count(*) from aluno where consultoria_id = ? and ativo", Long.class, consultoriaId);
        return total == null ? 0 : total;
    }

    /** Treinadores ativos mais convites ainda válidos, como a Minha conta conta. */
    public long membrosDaEquipe(UUID consultoriaId) {
        Long total = jdbc.queryForObject("select (select count(*) from usuario where consultoria_id = ? and papel = 'TREINADOR' and ativo) "
                + "+ (select count(*) from usuario_convite where consultoria_id = ? and usado_em is null and expira_em > now())",
                Long.class, consultoriaId, consultoriaId);
        return total == null ? 0 : total;
    }

    // --- convite do primeiro administrador ---------------------------------------------------------------------------

    public void inserirConviteDoAdministrador(UUID consultoriaId, String nome, String email, String codigoHash, Instant expiraEm) {
        jdbc.update("insert into usuario_convite(id, consultoria_id, email, nome, perfil_id, codigo_hash, expira_em, criado_por) "
                        + "values (?, ?, ?, ?, md5(?::text || ':Administrador')::uuid, ?, ?, null)",
                UUID.randomUUID(), consultoriaId, email, nome, consultoriaId.toString(), codigoHash, Timestamp.from(expiraEm));
    }

    /** Convite do sistema ({@code criado_por} nulo) ainda não aceito, vencido ou não: base da reemissão. */
    public Optional<ConviteDoAdministrador> convitePendenteDoAdministrador(UUID consultoriaId) {
        return jdbc.query("select id, nome, email from usuario_convite where consultoria_id = ? and criado_por is null "
                        + "and usado_em is null order by criado_em desc limit 1",
                (rs, n) -> new ConviteDoAdministrador(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3)),
                consultoriaId).stream().findFirst();
    }

    public void apagarConvitesPendentesDoAdministrador(UUID consultoriaId) {
        jdbc.update("delete from usuario_convite where consultoria_id = ? and criado_por is null and usado_em is null", consultoriaId);
    }
}
