package br.com.treinos.api.pagamentos;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import br.com.treinos.api.pagamentos.provedor.ConsultaDeCobranca;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * SQL nativo da caixa de entrada dos avisos de pagamento ({@code aviso_de_pagamento}), permitido no {@code ArquiteturaTest}:
 * a fila do conciliador e a limpeza são globais (vêm de todas as consultorias, sem {@code TenantContext}) e a busca do token
 * do webhook roda antes de se saber a consultoria. Todo o resto leva {@code consultoria_id} explícito, e nada daqui guarda
 * ou devolve o corpo do aviso: só identificadores, o hash e o andamento. O nome do aluno só sai em {@link #conferencias}, que
 * quem chama protege com a permissão de ver alunos.
 */
@Component
class AvisoDePagamentoRepositorio {

    /** Avisos (somando as repetições) que uma referência pode gerar; acima disso nada mais é gravado. */
    static final int MAXIMO_DE_AVISOS = 20;
    /** Motivo da conferência de uma transação aplicada que o provedor diz ter sido estornada. */
    static final String ESTORNO_INFORMADO = "ESTORNO_INFORMADO";

    /** Um aviso arrendado pelo conciliador. {@code revisao} é a lida na reserva: se mudar até o fim, o aviso foi rearmado. */
    record Reservado(UUID id, UUID consultoriaId, String referencia, String transacao, String slug, int revisao) {

        @Override
        public String toString() {
            return "Reservado[...]";
        }
    }

    /** A linha do aviso lida sob trava, para concluir. {@code estornoAvisado} = a marca permanente do evento {@code refunded}. */
    record Travado(String situacao, int revisao, int tentativas, UUID reservadoPor, boolean estornoAvisado) {
    }

    /**
     * O que o pagamento confirmado deixa de informação no aviso: o meio como o provedor o nomeou, as parcelas e o valor
     * bruto pago (pode incluir juros repassados). Só informação, nunca taxa nem líquido; campo ausente = nulo.
     */
    record DadosDoPagamento(String formaCapturada, Integer parcelas, Long valorBrutoCentavos) {

        static final DadosDoPagamento NENHUM = new DadosDoPagamento(null, null, null);

        static DadosDoPagamento de(ConsultaDeCobranca consulta) {
            Long bruto = consulta.valorPagoCentavos() != null && consulta.valorPagoCentavos() > 0
                    ? consulta.valorPagoCentavos() : null;
            return new DadosDoPagamento(consulta.formaCapturada(), consulta.parcelas(), bruto);
        }
    }

    record Conferencia(UUID id, UUID alunoId, String alunoNome, UUID cobrancaId, LocalDate competencia,
                       Long valorCobrancaCentavos, Long valorPagoCentavos, String motivo, Instant recebidoEm) {

        @Override
        public String toString() {
            return "Conferencia[" + id + "]";
        }
    }

    private final JdbcTemplate jdbc;

    AvisoDePagamentoRepositorio(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** A consultoria dona do token do webhook (vai no caminho da rota pública); nada é gravado por esta leitura. */
    Optional<UUID> consultoriaDoToken(String provedor, String token) {
        return jdbc.query("select consultoria_id from credencial_pagamento where provedor = ? and token_aviso = ?",
                (rs, n) -> rs.getObject(1, UUID.class), provedor, token).stream().findFirst();
    }

    /**
     * Grava o aviso ou rearma a consulta de um que já existe (mesma transação do provedor): {@code revisao + 1}, PENDENTE,
     * já. APLICADO e IGNORADO também rearmam (é assim que se descobre um estorno); CONFERIR e CONFERIDO não mudam, para
     * não reabrir o que o treinador já resolveu nem multiplicar a fila de conferência. A reserva de quem consulta não é
     * tocada: ele vê a revisão nova ao concluir. A {@code referencia} gravada primeiro é a que vale. Este upsert nunca escreve
     * {@code estorno_avisado_em}: a marca do {@code refunded} (ver {@link #registrarEstorno}) sobrevive a qualquer repetição.
     *
     * <p>Teto de {@value #MAXIMO_DE_AVISOS} transações distintas por (consultoria, provedor, referência): cada transação nova
     * vira uma consulta à InfinitePay, e o aviso e o retorno do navegador podem ser repetidos à vontade por quem tem o token ou
     * a sessão. Conta-se linhas, não repetições: repetir uma transação que já existe só a rearma e nunca gasta o teto (ninguém
     * esgota o de uma cobrança repetindo o mesmo aviso); a 21ª transação distinta não é gravada. A conferência é feita no mesmo
     * comando que grava, sem corrida. Devolve se gravou ou rearmou algo.
     *
     * <p>Slug: o do webhook preenche e atualiza; o que veio do retorno do navegador ({@code doNavegador}) só preenche quando
     * ainda não há slug, e nunca sobrescreve o que o webhook gravou.
     */
    boolean registrar(UUID consultoriaId, String provedor, String referencia, String transacao, String slug, String hashCorpo,
                      boolean doNavegador) {
        String slugFinal = doNavegador ? "coalesce(aviso_de_pagamento.slug, excluded.slug)"
                : "coalesce(excluded.slug, aviso_de_pagamento.slug)";
        return jdbc.update("insert into aviso_de_pagamento (id, consultoria_id, provedor, referencia, transacao, slug, hash_corpo, "
                + "recebido_em, revisao, proxima_tentativa, situacao) select ?::uuid, ?::uuid, ?::varchar, ?::varchar, ?::varchar, "
                + "?::varchar, ?::char(64), now(), 1, now(), 'PENDENTE' where ((select count(*) from aviso_de_pagamento "
                + "where consultoria_id = ?::uuid and provedor = ?::varchar and referencia = ?::varchar) < ? "
                + "or exists (select 1 from aviso_de_pagamento where consultoria_id = ?::uuid and provedor = ?::varchar "
                + "and transacao = ?::varchar)) "
                + "on conflict (consultoria_id, provedor, transacao) do update set revisao = aviso_de_pagamento.revisao + 1, "
                + "situacao = 'PENDENTE', motivo = null, tentativas = 0, proxima_tentativa = now(), recebido_em = now(), "
                + "hash_corpo = excluded.hash_corpo, slug = " + slugFinal + " "
                + "where aviso_de_pagamento.situacao in ('PENDENTE', 'APLICADO', 'IGNORADO')",
                UUID.randomUUID(), consultoriaId, provedor, referencia, transacao, slug, hashCorpo, consultoriaId, provedor,
                referencia, MAXIMO_DE_AVISOS, consultoriaId, provedor, transacao) > 0;
    }

    /** O aviso depois de um evento {@code refunded}: o id e se este evento o levou para a conferência agora. */
    record EstornoRegistrado(UUID id, boolean foiParaConferir) {
    }

    /**
     * O provedor mandou o evento {@code refunded} desta transação. Grava a marca permanente {@code estorno_avisado_em} (a
     * primeira vez que veio; nenhum aviso posterior a zera ou muda, porque nenhum outro comando do repositório a escreve) e
     * mexe na situação pela regra do dono, sem nova consulta e sem tocar na cobrança nem na baixa:
     * <ul>
     * <li>marca nova e aviso PENDENTE, APLICADO, IGNORADO ou CONFERIDO: vai para CONFERIR/{@value #ESTORNO_INFORMADO}. Reabre o
     * CONFERIDO porque o estorno é um fato novo que o treinador ainda não viu; o que o aviso já guardava (valor, forma) fica;</li>
     * <li>marca nova e aviso já em CONFERIR por outro motivo: o motivo atual fica, só a marca é gravada;</li>
     * <li>marca que já existia: nada muda (não reabre o CONFERIDO de um estorno que o treinador já viu);</li>
     * <li>aviso que ainda não existe: nasce PENDENTE já com a marca (o conciliador a vê ao concluir e manda para a conferência
     * mesmo que a consulta diga "pago"), respeitando o mesmo teto de {@value #MAXIMO_DE_AVISOS} transações distintas.</li>
     * </ul>
     * Lê a linha com {@code for update}: roda na transação de quem chama. Vazio = aviso novo acima do teto, nada gravado.
     */
    Optional<EstornoRegistrado> registrarEstorno(UUID consultoriaId, String provedor, String referencia, String transacao,
                                                 String slug, String hashCorpo) {
        // Duas voltas: o INSERT pode perder a corrida para outro aviso da mesma transação, que então já está visível.
        for (int volta = 0; volta < 2; volta++) {
            Optional<LinhaDoEstorno> existente = jdbc.query("select id, situacao, estorno_avisado_em is not null "
                    + "from aviso_de_pagamento where consultoria_id = ? and provedor = ? and transacao = ? for update",
                    (rs, n) -> new LinhaDoEstorno(rs.getObject(1, UUID.class), rs.getString(2), rs.getBoolean(3)),
                    consultoriaId, provedor, transacao).stream().findFirst();
            if (existente.isPresent()) {
                return Optional.of(marcarNoExistente(consultoriaId, existente.get()));
            }
            UUID novo = UUID.randomUUID();
            int gravou = jdbc.update("insert into aviso_de_pagamento (id, consultoria_id, provedor, referencia, transacao, slug, "
                    + "hash_corpo, recebido_em, revisao, proxima_tentativa, situacao, estorno_avisado_em) select ?::uuid, ?::uuid, "
                    + "?::varchar, ?::varchar, ?::varchar, ?::varchar, ?::char(64), now(), 1, now(), 'PENDENTE', now() "
                    + "where (select count(*) from aviso_de_pagamento where consultoria_id = ?::uuid and provedor = ?::varchar "
                    + "and referencia = ?::varchar) < ? on conflict (consultoria_id, provedor, transacao) do nothing",
                    novo, consultoriaId, provedor, referencia, transacao, slug, hashCorpo, consultoriaId, provedor, referencia,
                    MAXIMO_DE_AVISOS);
            if (gravou > 0) {
                return Optional.of(new EstornoRegistrado(novo, false));
            }
        }
        return Optional.empty();
    }

    private record LinhaDoEstorno(UUID id, String situacao, boolean jaTinhaMarca) {
    }

    private EstornoRegistrado marcarNoExistente(UUID consultoriaId, LinhaDoEstorno linha) {
        if (linha.jaTinhaMarca()) {
            return new EstornoRegistrado(linha.id(), false);
        }
        if ("CONFERIR".equals(linha.situacao())) {
            // Já em conferência por outro motivo: o motivo fica, só a marca é gravada.
            jdbc.update("update aviso_de_pagamento set estorno_avisado_em = now() where id = ? and consultoria_id = ?",
                    linha.id(), consultoriaId);
            return new EstornoRegistrado(linha.id(), false);
        }
        // O valor, a forma e os demais dados do pagamento que o aviso já guardava ficam; a cobrança só entra se faltava a
        // ligação (a referência gravada é o id dela), para a conferência mostrar de quem é. Reabrir o CONFERIDO limpa quem o conferiu.
        jdbc.update("update aviso_de_pagamento set estorno_avisado_em = now(), situacao = 'CONFERIR', motivo = '"
                + ESTORNO_INFORMADO + "', recebido_em = now(), reservado_por = null, reserva_ate = null, conferido_por = null, "
                + "conferido_em = null, cobranca_id = coalesce(cobranca_id, (select c.id from cobranca_aluno c "
                + "where c.consultoria_id = aviso_de_pagamento.consultoria_id and c.id::text = aviso_de_pagamento.referencia)) "
                + "where id = ? and consultoria_id = ?",
                linha.id(), consultoriaId);
        return new EstornoRegistrado(linha.id(), true);
    }

    /**
     * Arrenda um lote vencido num só comando (molde de {@code FotoRemocaoRepositorio.arrendarVencidas}): {@code skip locked}
     * evita dois conciliadores com o mesmo aviso, e quem não terminar em {@code segundos} o devolve à fila sozinho.
     */
    List<Reservado> reservar(UUID dono, int limite, int segundos) {
        return jdbc.query("update aviso_de_pagamento a set reservado_por = ?, reserva_ate = now() + make_interval(secs => ?) "
                + "where a.id in (select id from aviso_de_pagamento where situacao = 'PENDENTE' and proxima_tentativa <= now() "
                + "and (reservado_por is null or reserva_ate < now()) order by proxima_tentativa limit ? for update skip locked) "
                + "returning a.id, a.consultoria_id, a.referencia, a.transacao, a.slug, a.revisao",
                (rs, n) -> new Reservado(rs.getObject("id", UUID.class), rs.getObject("consultoria_id", UUID.class),
                        rs.getString("referencia"), rs.getString("transacao"), rs.getString("slug"), rs.getInt("revisao")),
                dono, (double) segundos, limite);
    }

    /** Trava a linha do aviso (a primeira trava do concluir: nunca se trava o aviso depois da cobrança). */
    Optional<Travado> travar(UUID consultoriaId, UUID id) {
        return jdbc.query("select situacao, revisao, tentativas, reservado_por, estorno_avisado_em is not null as estorno_avisado "
                + "from aviso_de_pagamento where id = ? and consultoria_id = ? for update",
                (rs, n) -> new Travado(rs.getString("situacao"), rs.getInt("revisao"), rs.getInt("tentativas"),
                        rs.getObject("reservado_por", UUID.class), rs.getBoolean("estorno_avisado")), id, consultoriaId)
                .stream().findFirst();
    }

    /** Devolve o aviso à fila como está (foi rearmado no meio, ou não há o que fazer agora). */
    void liberar(UUID consultoriaId, UUID id) {
        jdbc.update("update aviso_de_pagamento set reservado_por = null, reserva_ate = null where id = ? and consultoria_id = ?",
                id, consultoriaId);
    }

    /** Nova tentativa daqui a {@code segundos}, contando uma tentativa. */
    void reagendar(UUID consultoriaId, UUID id, long segundos) {
        jdbc.update("update aviso_de_pagamento set tentativas = tentativas + 1, "
                + "proxima_tentativa = now() + make_interval(secs => ?), reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ?", (double) segundos, id, consultoriaId);
    }

    /** Fecha o aviso nesta rodada (APLICADO, IGNORADO ou CONFERIR) e libera a reserva. */
    void encerrar(UUID consultoriaId, UUID id, String situacao, String motivo, Long valorPagoCentavos, UUID cobrancaId,
                  DadosDoPagamento dados) {
        jdbc.update("update aviso_de_pagamento set situacao = ?, motivo = ?, valor_pago_centavos = ?, cobranca_id = ?, "
                + "forma_capturada = ?, parcelas = ?, valor_bruto_pago_centavos = ?, reservado_por = null, reserva_ate = null "
                + "where id = ? and consultoria_id = ?",
                situacao, motivo, valorPagoCentavos, cobrancaId, dados.formaCapturada(), dados.parcelas(),
                dados.valorBrutoCentavos(), id, consultoriaId);
    }

    /**
     * Fecha como CONFERIR/{@value #ESTORNO_INFORMADO} o aviso de uma transação já aplicada que a consulta não vê mais paga.
     * Não usa {@link #encerrar}: o valor, a cobrança e os dados do pagamento que o aviso já guardava ficam como estão.
     */
    void conferirEstorno(UUID consultoriaId, UUID id, UUID cobrancaId, long valorPagoCentavos) {
        jdbc.update("update aviso_de_pagamento set situacao = 'CONFERIR', motivo = '" + ESTORNO_INFORMADO
                + "', cobranca_id = coalesce(cobranca_id, ?), valor_pago_centavos = coalesce(valor_pago_centavos, ?), "
                + "reservado_por = null, reserva_ate = null where id = ? and consultoria_id = ?",
                cobrancaId, valorPagoCentavos, id, consultoriaId);
    }

    /** Apaga o que já foi resolvido e é velho. Global, sem dado de pessoa. Devolve quantos. */
    int limpar(int dias) {
        return jdbc.update("delete from aviso_de_pagamento where situacao in ('APLICADO', 'IGNORADO', 'CONFERIDO') "
                + "and recebido_em < now() - make_interval(days => ?)", dias);
    }

    /**
     * Os avisos para conferir da consultoria, mais recentes primeiro, com cobrança e aluno numa consulta só. A cobrança e o
     * aluno entram pela mesma consultoria do aviso; sem cobrança (ou sem aluno) esses campos voltam nulos.
     */
    List<Conferencia> conferencias(UUID consultoriaId, int limite) {
        return jdbc.query("select a.id, c.aluno_id, al.nome, a.cobranca_id, c.competencia, c.valor_centavos, "
                + "a.valor_pago_centavos, a.motivo, a.recebido_em from aviso_de_pagamento a "
                + "left join cobranca_aluno c on c.consultoria_id = a.consultoria_id and c.id = a.cobranca_id "
                + "left join aluno al on al.consultoria_id = c.consultoria_id and al.id = c.aluno_id "
                + "where a.consultoria_id = ? and a.situacao = 'CONFERIR' order by a.recebido_em desc, a.id desc limit ?",
                (rs, n) -> new Conferencia(rs.getObject("id", UUID.class), rs.getObject("aluno_id", UUID.class),
                        rs.getString("nome"), rs.getObject("cobranca_id", UUID.class),
                        rs.getObject("competencia", LocalDate.class), rs.getObject("valor_centavos", Long.class),
                        rs.getObject("valor_pago_centavos", Long.class), rs.getString("motivo"),
                        rs.getObject("recebido_em", OffsetDateTime.class).toInstant()), consultoriaId, limite);
    }

    /** A situação do aviso da consultoria, já com a linha travada (o "conferido" não concorre com o conciliador). */
    Optional<String> situacaoTravada(UUID consultoriaId, UUID id) {
        return jdbc.query("select situacao from aviso_de_pagamento where id = ? and consultoria_id = ? for update",
                (rs, n) -> rs.getString(1), id, consultoriaId).stream().findFirst();
    }

    void marcarConferido(UUID consultoriaId, UUID id, UUID usuarioId) {
        jdbc.update("update aviso_de_pagamento set situacao = 'CONFERIDO', conferido_por = ?, conferido_em = now() "
                + "where id = ? and consultoria_id = ?", usuarioId, id, consultoriaId);
    }

    /**
     * O slug do aviso é o do link do pagador: sai junto com o da cobrança quando o aluno é anonimizado. As cobranças do
     * aluno são achadas pelo {@code order_nsu} (o id delas), que o aviso guarda mesmo sem ligação.
     */
    void limparSlugsDoAluno(UUID consultoriaId, UUID alunoId) {
        jdbc.update("update aviso_de_pagamento set slug = null where consultoria_id = ? and slug is not null "
                + "and referencia in (select id::text from cobranca_aluno where consultoria_id = ? and aluno_id = ?)",
                consultoriaId, consultoriaId, alunoId);
    }
}
