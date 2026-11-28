package br.com.treinos.api.push;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * SQL nativo do push ({@code push_token} e {@code push_envio}), permitido no {@code ArquiteturaTest}: o job reserva e envia de
 * todas as consultorias de uma vez, sem {@code TenantContext}. Toda escrita leva {@code consultoria_id} explícito e, depois da
 * reserva, confere a posse ({@code reservado_por}). Duas são globais de propósito: {@link #registrar} apaga o mesmo token de
 * qualquer outra conta ou consultoria (o token é único no banco) e {@link #limpar} apaga o token vencido e a fila antiga de
 * todas. O valor do token só sai daqui para o envio ({@link #tokens}); nada daqui lê texto ou compromisso, e o único nome lido é o
 * do aluno do aviso de atenção ({@link #nomesDaAtencao}), que vai só ao corpo do push do responsável.
 */
@Component
class PushRepositorio {

    /** Um envio arrendado pelo job. */
    record Reservado(UUID id, UUID consultoriaId, UUID usuarioId, int tentativas, TipoDePush tipo) {

        Reservado(UUID id, UUID consultoriaId, UUID usuarioId, int tentativas) {
            this(id, consultoriaId, usuarioId, tentativas, TipoDePush.COMPROMISSO);
        }
    }

    static final int DIAS_DE_VALIDADE_DO_TOKEN = 30;

    private final JdbcTemplate jdbc;

    PushRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ---- token ----

    /**
     * Registra (ou renova) o token do usuário e guarda só os {@code maximo} mais novos. O aparelho é de quem entrou por último:
     * o mesmo token em QUALQUER outra conta ou consultoria é apagado (a única consulta global daqui, de propósito: o token é
     * único no banco e o dono antigo nunca pode avisar um aparelho que já não é dele). O {@code on conflict (token)} só cobre
     * a corrida entre dois registros do mesmo aparelho.
     */
    void registrar(UUID consultoriaId, UUID usuarioId, String token, String plataforma, int maximo) {
        jdbc.update("delete from push_token where token = ? and not (consultoria_id = ? and usuario_id = ?)",
                token, consultoriaId, usuarioId);
        jdbc.update("insert into push_token (id, consultoria_id, usuario_id, token, plataforma) values (?, ?, ?, ?, ?) "
                + "on conflict (token) do update set consultoria_id = excluded.consultoria_id, usuario_id = excluded.usuario_id, "
                + "plataforma = excluded.plataforma, atualizado_em = now()",
                UUID.randomUUID(), consultoriaId, usuarioId, token, plataforma);
        jdbc.update("delete from push_token where id in (select id from push_token where consultoria_id = ? and usuario_id = ? "
                + "order by atualizado_em desc, id offset ?)", consultoriaId, usuarioId, maximo);
    }

    void removerToken(UUID consultoriaId, UUID usuarioId, String token) {
        jdbc.update("delete from push_token where consultoria_id = ? and usuario_id = ? and token = ?", consultoriaId, usuarioId, token);
    }

    void apagarDoUsuario(UUID consultoriaId, UUID usuarioId) {
        jdbc.update("delete from push_token where consultoria_id = ? and usuario_id = ?", consultoriaId, usuarioId);
    }

    /** Token que o Expo disse não existir mais ({@code DeviceNotRegistered}). */
    void apagarTokenInvalido(UUID consultoriaId, String token) {
        jdbc.update("delete from push_token where consultoria_id = ? and token = ?", consultoriaId, token);
    }

    // ---- fila ----

    /**
     * Enfileira um aviso para cada aluno ATIVO e com acesso que já tem token; quem já tem um PENDENTE fica como está. Roda na
     * transação de quem muda o compromisso (mesma conexão).
     */
    void enfileirar(UUID consultoriaId, Collection<UUID> alunoIds, TipoDePush tipo) {
        for (UUID alunoId : alunoIds) {
            jdbc.update("insert into push_envio (id, consultoria_id, usuario_id, tipo) "
                    + "select ?, a.consultoria_id, a.usuario_id, ? from aluno a where a.consultoria_id = ? and a.id = ? "
                    + "and a.ativo and a.anonimizado_em is null and a.usuario_id is not null "
                    + "and exists (select 1 from push_token t where t.consultoria_id = a.consultoria_id and t.usuario_id = a.usuario_id) "
                    + "on conflict (consultoria_id, usuario_id, tipo) where situacao = 'PENDENTE' do nothing",
                    UUID.randomUUID(), tipo.name(), consultoriaId, alunoId);
        }
    }

    /** O responsável do aluno (o critério de "Meus alunos"), ou nulo. */
    UUID responsavelDoAluno(UUID consultoriaId, UUID alunoId) {
        return jdbc.query("select responsavel_id from aluno where consultoria_id = ? and id = ?",
                rs -> rs.next() ? rs.getObject(1, UUID.class) : null, consultoriaId, alunoId);
    }

    /**
     * Enfileira o aviso de atenção para o membro ATIVO da equipe, com a preferência ligada e com token; quem já tem um PENDENTE do
     * tipo fica como está (o aviso junta os alunos). As permissões já foram conferidas em Java ({@code PermissoesDoUsuario}: o
     * Administrador não guarda linhas em {@code perfil_permissao}). Roda na transação de quem chama (mesma conexão), depois de os
     * fatos do envio serem gravados: o {@code criado_em} do envio é o dos fatos deste aluno (o mesmo relógio, o da API), e é dele
     * que {@link #nomesDaAtencao} conta os alunos do aviso.
     */
    void enfileirarAtencao(UUID consultoriaId, UUID usuarioId, UUID alunoId) {
        jdbc.update("insert into push_envio (id, consultoria_id, usuario_id, tipo, criado_em) "
                + "select ?, u.consultoria_id, u.id, ?, coalesce((select max(f.criado_em) from atualizacao_atencao f "
                + "join atualizacao t on t.consultoria_id = f.consultoria_id and t.id = f.atualizacao_id "
                + "where f.consultoria_id = u.consultoria_id and t.aluno_id = ?), now()) "
                + "from usuario u where u.consultoria_id = ? and u.id = ? "
                + "and u.ativo and u.papel = 'TREINADOR' and u.push_atencao "
                + "and exists (select 1 from push_token t where t.consultoria_id = u.consultoria_id and t.usuario_id = u.id) "
                + "on conflict (consultoria_id, usuario_id, tipo) where situacao = 'PENDENTE' do nothing",
                UUID.randomUUID(), TipoDePush.ATUALIZACAO_ATENCAO.name(), alunoId, consultoriaId, usuarioId);
    }

    /**
     * Os nomes dos alunos (no máximo 2: só importa se é um só) com pontos de atenção gravados desde que o envio nasceu, ainda
     * ativos, não anonimizados e que ainda têm o membro do envio como responsável. Quem deixou de ser o responsável não vê o nome.
     */
    List<String> nomesDaAtencao(UUID consultoriaId, UUID envioId) {
        return jdbc.queryForList("select a.nome from push_envio p "
                + "join atualizacao_atencao f on f.consultoria_id = p.consultoria_id and f.criado_em >= p.criado_em "
                + "join atualizacao t on t.consultoria_id = f.consultoria_id and t.id = f.atualizacao_id "
                + "join aluno a on a.consultoria_id = t.consultoria_id and a.id = t.aluno_id "
                + "where p.consultoria_id = ? and p.id = ? and a.responsavel_id = p.usuario_id and a.ativo and a.anonimizado_em is null "
                + "group by a.id, a.nome limit 2", String.class, consultoriaId, envioId);
    }

    /** Arrenda um lote de pendentes vencidos num comando só ({@code skip locked}); quem não concluir devolve à fila sozinho. */
    List<Reservado> reservar(UUID dono, int limite, int segundos) {
        return jdbc.query("update push_envio p set reservado_por = ?, reserva_ate = now() + make_interval(secs => ?) "
                + "where p.id in (select id from push_envio where situacao = 'PENDENTE' and proxima_tentativa <= now() "
                + "and (reservado_por is null or reserva_ate < now()) order by proxima_tentativa limit ? for update skip locked) "
                + "returning p.id, p.consultoria_id, p.usuario_id, p.tentativas, p.tipo",
                (rs, n) -> new Reservado(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                        rs.getInt(4), TipoDePush.valueOf(rs.getString(5))),
                dono, (double) segundos, limite);
    }

    /**
     * Tipos do aluno ({@code COMPROMISSO}, {@code PLANO_LIBERADO}): o usuário ainda é um aluno ativo, não anonimizado, com a conta
     * ativa? Senão o push não vai e os tokens saem. O membro da equipe ({@code ATUALIZACAO_ATENCAO}) é conferido em
     * {@link PushService#situacaoDoMembro}.
     */
    boolean elegivel(UUID consultoriaId, UUID usuarioId) {
        Integer n = jdbc.queryForObject("select count(*) from usuario u join aluno a on a.consultoria_id = u.consultoria_id "
                + "and a.usuario_id = u.id where u.consultoria_id = ? and u.id = ? and u.ativo and a.ativo "
                + "and a.anonimizado_em is null", Integer.class, consultoriaId, usuarioId);
        return n != null && n > 0;
    }

    List<String> tokens(UUID consultoriaId, UUID usuarioId) {
        return jdbc.queryForList("select token from push_token where consultoria_id = ? and usuario_id = ? order by criado_em, id",
                String.class, consultoriaId, usuarioId);
    }

    void enviado(UUID consultoriaId, UUID id, UUID dono) {
        jdbc.update("update push_envio set situacao = 'ENVIADO', tentativas = tentativas + 1, enviado_em = now(), "
                + "erro = null, atualizado_em = now(), reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ? and situacao = 'PENDENTE' and reservado_por = ?", id, consultoriaId, dono);
    }

    void cancelar(UUID consultoriaId, UUID id, UUID dono, String motivo) {
        jdbc.update("update push_envio set situacao = 'CANCELADO', motivo = ?, atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ? and situacao = 'PENDENTE' and reservado_por = ?",
                motivo, id, consultoriaId, dono);
    }

    /** O envio falhou: conta a tentativa e guarda só a classe do erro. Na {@code maximo}-ésima vira FALHOU; antes, volta à fila. */
    void falhou(UUID consultoriaId, UUID id, UUID dono, String classeDoErro, int maximo, long segundos) {
        jdbc.update("update push_envio set tentativas = tentativas + 1, erro = ?, "
                + "situacao = case when tentativas + 1 >= ? then 'FALHOU' else 'PENDENTE' end, "
                + "proxima_tentativa = now() + make_interval(secs => ?), atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ? and situacao = 'PENDENTE' and reservado_por = ?",
                classeDoErro, maximo, (double) segundos, id, consultoriaId, dono);
    }

    /**
     * Limpeza global: pendente velho demais não faz mais sentido ("Compromisso atualizado" horas depois), o concluído some em 7
     * dias e o token que o app não renova há {@value #DIAS_DE_VALIDADE_DO_TOKEN} dias some também (o app registra de novo a
     * cada abertura da área do aluno; sem abrir o app por um mês, o aparelho foi trocado, apagado ou esquecido).
     */
    void limpar(int horasDePendente) {
        jdbc.update("delete from push_token where atualizado_em < now() - make_interval(days => ?)", DIAS_DE_VALIDADE_DO_TOKEN);
        jdbc.update("update push_envio set situacao = 'CANCELADO', motivo = 'EXPIRADO', atualizado_em = now(), "
                + "reservado_por = null, reserva_ate = null where situacao = 'PENDENTE' "
                + "and criado_em < now() - make_interval(hours => ?) and (reservado_por is null or reserva_ate < now())", horasDePendente);
        jdbc.update("delete from push_envio where situacao <> 'PENDENTE' and atualizado_em < now() - interval '7 days'");
    }
}
