package br.com.treinos.api.conta;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

import br.com.treinos.api.conta.MinhaContaDto.ClienteDto;
import br.com.treinos.api.conta.MinhaContaDto.ContratacaoDto;
import tools.jackson.core.type.TypeReference;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Tabelas locais da Minha conta ({@code direitos_locais}, {@code conta_comercial_local}, {@code cobranca_local}).
 * São globais (sem {@code @TenantId}, como na Central/Servirea): a integração as lê fora do contexto da consultoria.
 * Por isso toda consulta recebe e filtra {@code consultoria_id} explicitamente; SQL nativo permitido no
 * {@code ArquiteturaTest} por isso.
 */
@Component
public class ContaLocalRepositorio {

    private static final TypeReference<Map<String, Long>> LIMITES = new TypeReference<>() { };

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

    public Optional<DireitosLocais> direitos(UUID consultoriaId) {
        return jdbc.query("select contratacao_id, versao, situacao, acesso_liberado, motivo_bloqueio, vigente_ate, "
                        + "plano_codigo, plano_nome, limites::text, funcionalidades, confirmado_em "
                        + "from direitos_locais where consultoria_id = ?",
                (rs, n) -> new DireitosLocais(consultoriaId, rs.getObject(1, UUID.class), rs.getLong(2), rs.getString(3),
                        rs.getBoolean(4), rs.getString(5), data(rs.getDate(6)), rs.getString(7), rs.getString(8),
                        json.readValue(rs.getString(9), LIMITES),
                        Arrays.asList((String[]) rs.getArray(10).getArray()), rs.getTimestamp(11).toInstant()),
                consultoriaId).stream().findFirst();
    }

    public Optional<ContaComercialLocal> contaComercial(UUID consultoriaId) {
        return jdbc.query("select cliente::text, contratacao::text from conta_comercial_local where consultoria_id = ?",
                (rs, n) -> new ContaComercialLocal(json.readValue(rs.getString(1), ClienteDto.class),
                        json.readValue(rs.getString(2), ContratacaoDto.class)),
                consultoriaId).stream().findFirst();
    }

    /** Da mais recente para a mais antiga, como no contrato. */
    public List<CobrancaLocal> cobrancas(UUID consultoriaId) {
        return jdbc.query("select id, competencia_inicio, competencia_fim, vencimento, valor, situacao, pago_em "
                        + "from cobranca_local where consultoria_id = ? order by competencia_inicio desc, vencimento desc",
                (rs, n) -> new CobrancaLocal(rs.getObject(1, UUID.class), data(rs.getDate(2)), data(rs.getDate(3)),
                        data(rs.getDate(4)), rs.getBigDecimal(5), rs.getString(6), data(rs.getDate(7))),
                consultoriaId);
    }

    private static LocalDate data(Date valor) {
        return valor == null ? null : valor.toLocalDate();
    }

    private boolean existe(String sql, UUID consultoriaId) {
        Integer total = jdbc.queryForObject(sql, Integer.class, consultoriaId);
        return total != null && total > 0;
    }
}
