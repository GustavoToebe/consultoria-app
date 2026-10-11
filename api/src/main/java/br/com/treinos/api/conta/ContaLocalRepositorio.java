package br.com.treinos.api.conta;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.UUID;

/**
 * Tabelas locais da Minha conta ({@code direitos_locais}, {@code conta_comercial_local}, {@code cobranca_local}).
 * São globais (sem {@code @TenantId}, como na Central/Servirea): a integração as lê fora do contexto da consultoria.
 * Por isso toda consulta recebe e filtra {@code consultoria_id} explicitamente; SQL nativo permitido no
 * {@code ArquiteturaTest} por isso.
 */
@Component
public class ContaLocalRepositorio {

    private final JdbcTemplate jdbc;
    private final JsonMapper json;

    public ContaLocalRepositorio(JdbcTemplate jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public boolean temDireitos(UUID consultoriaId) {
        return existe("select count(*) from direitos_locais where consultoria_id = ?", consultoriaId);
    }

    public boolean temContaComercial(UUID consultoriaId) {
        return existe("select count(*) from conta_comercial_local where consultoria_id = ?", consultoriaId);
    }

    public boolean temCobrancas(UUID consultoriaId) {
        return existe("select count(*) from cobranca_local where consultoria_id = ?", consultoriaId);
    }

    /** Grava ou substitui a linha da consultoria (um snapshot por consultoria, como na Central). */
    public void gravarDireitos(DireitosLocais d) {
        jdbc.update("insert into direitos_locais(consultoria_id, contratacao_id, versao, situacao, acesso_liberado, "
                        + "motivo_bloqueio, vigente_ate, plano_codigo, plano_nome, limites, funcionalidades, confirmado_em) "
                        + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, string_to_array(?, ','), ?) "
                        + "on conflict (consultoria_id) do update set contratacao_id = excluded.contratacao_id, "
                        + "versao = excluded.versao, situacao = excluded.situacao, acesso_liberado = excluded.acesso_liberado, "
                        + "motivo_bloqueio = excluded.motivo_bloqueio, vigente_ate = excluded.vigente_ate, "
                        + "plano_codigo = excluded.plano_codigo, plano_nome = excluded.plano_nome, limites = excluded.limites, "
                        + "funcionalidades = excluded.funcionalidades, confirmado_em = excluded.confirmado_em, atualizado_em = now()",
                d.consultoriaId(), d.contratacaoId(), d.versao(), d.situacao(), d.acessoLiberado(), d.motivoBloqueio(),
                d.vigenteAte() == null ? null : Date.valueOf(d.vigenteAte()), d.planoCodigo(), d.planoNome(),
                json.writeValueAsString(d.limites()), String.join(",", d.funcionalidades()),
                Timestamp.from(d.confirmadoEm()));
    }

    /** {@code cliente} e {@code contratacao} no formato da seção 6.3 do contrato. */
    public void gravarContaComercial(UUID consultoriaId, Object cliente, Object contratacao) {
        jdbc.update("insert into conta_comercial_local(consultoria_id, cliente, contratacao) values (?, ?::jsonb, ?::jsonb) "
                        + "on conflict (consultoria_id) do update set cliente = excluded.cliente, "
                        + "contratacao = excluded.contratacao, atualizado_em = now()",
                consultoriaId, json.writeValueAsString(cliente), json.writeValueAsString(contratacao));
    }

    public void gravarCobranca(UUID consultoriaId, CobrancaLocal c) {
        jdbc.update("insert into cobranca_local(id, consultoria_id, competencia_inicio, competencia_fim, vencimento, "
                        + "valor, situacao, pago_em) values (?, ?, ?, ?, ?, ?, ?, ?) on conflict (id) do nothing",
                c.id(), consultoriaId, Date.valueOf(c.competenciaInicio()), Date.valueOf(c.competenciaFim()),
                Date.valueOf(c.vencimento()), c.valor(), c.situacao(),
                c.pagoEm() == null ? null : Date.valueOf(c.pagoEm()));
    }

    private boolean existe(String sql, UUID consultoriaId) {
        Integer total = jdbc.queryForObject(sql, Integer.class, consultoriaId);
        return total != null && total > 0;
    }
}
