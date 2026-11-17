package br.com.treinos.api.pagamentos;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}, também nos {@code join ... on}). Os agregados
 * do painel recebem a situação como parâmetro (a comparação do enum com texto não passa no HQL) e o responsável do filtro
 * "Meus" ({@code null} = todos). Somas sem linha voltam {@code null}: "sem dado", nunca zero inventado.
 */
public interface CobrancaAlunoRepository extends JpaRepository<CobrancaAluno, UUID> {

    /** A contratação e o aluno de uma cobrança, lidos antes de travar (a cobrança só entra na sessão já travada). */
    interface Referencias {
        UUID getContratacaoId();

        UUID getAlunoId();
    }

    interface Soma {
        Long getTotal();

        Long getQuantidade();
    }

    interface TotaisDaLista {
        Long getTotal();

        Long getPago();

        Long getEmAberto();

        Long getVencido();
    }

    interface SomaMensal {
        Integer getAno();

        Integer getMes();

        Long getTotal();
    }

    interface PorForma {
        FormaDePagamento getForma();

        Long getQuantidade();

        Long getTotal();
    }

    interface PorPlano {
        UUID getPlanoId();

        String getNome();

        Long getQuantidade();

        Long getTotal();
    }

    String LINHA = "select new br.com.treinos.api.pagamentos.LinhaDeCobranca(c, a.nome, p.nome, u.nome) "
            + "from CobrancaAluno c join Aluno a on a.id = c.alunoId "
            + "left join ContratacaoAluno k on k.id = c.contratacaoId "
            + "left join PlanoComercial p on p.id = k.planoComercialId "
            + "left join Usuario u on u.id = c.baixaPor ";

    String FILTRO = "where (:todas = true or c.situacao = :situacao) and (:soVencidas = false or c.vencimento < :hoje) "
            + "and c.vencimento between :de and :ate and (:alunoId is null or c.alunoId = :alunoId) "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId) ";

    String CONTAGEM = "select count(c) from CobrancaAluno c join Aluno a on a.id = c.alunoId ";

    /**
     * Filtros da lista {@code GET /financeiro/cobrancas} (lote 2 dos filtros). Situações: sem nenhuma, todas; as gravadas
     * vêm em {@code situacoes} ({@code filtraSituacoes}) e VENCIDA (aberta com vencimento antes de hoje, calculada) em
     * {@code soVencidas}, as duas em OU. {@code forma}: vazio = qualquer; {@code MANUAL} = baixa registrada pelo treinador
     * (provedor {@code MANUAL}); {@code ONLINE} = baixa confirmada por um provedor (as duas só em cobranças com baixa).
     * {@code nome} é o padrão do LIKE no nome do aluno ({@code busca} liga).
     */
    String FILTRO_DA_LISTA = "where ((:filtraSituacoes = false and :soVencidas = false) "
            + "or (:filtraSituacoes = true and c.situacao in :situacoes) "
            + "or (:soVencidas = true and c.situacao = :aberta and c.vencimento < :hoje)) "
            + "and c.vencimento between :de and :ate and (:alunoId is null or c.alunoId = :alunoId) "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId) "
            + "and (:planoId is null or k.planoComercialId = :planoId) "
            + "and (:forma = '' or (c.forma is not null and ((:forma = 'MANUAL' and c.provedor = 'MANUAL') "
            + "or (:forma = 'ONLINE' and c.provedor <> 'MANUAL')))) "
            + "and (:busca = false or lower(a.nome) like :nome escape '\\') "
            + "and c.criadoEm >= :emissaoDe and c.criadoEm < :emissaoAte "
            + "and (:filtraPagamento = false or c.pagoEm between :pagoDe and :pagoAte) ";

    // left join: a cobrança avulsa não tem contratação e tem de aparecer na lista, na contagem e nos totais.
    String CONTAGEM_DA_LISTA = "select count(c) from CobrancaAluno c join Aluno a on a.id = c.alunoId "
            + "left join ContratacaoAluno k on k.id = c.contratacaoId ";

    /**
     * Totais da lista sobre o filtro inteiro ({@link #FILTRO_DA_LISTA}, sem paginar): CANCELADA e ESTORNADA ficam fora de tudo.
     * {@code total} = todas as demais (aberta, paga e contestada); {@code pago} = só PAGA (como o recebido do painel);
     * {@code emAberto} = ABERTA (inclui a vencida); {@code vencido} = ABERTA com vencimento antes de hoje.
     */
    String TOTAIS = "select coalesce(sum(c.valorCentavos), 0L) as total, "
            + "coalesce(sum(case when c.situacao = :paga then c.valorCentavos else 0L end), 0L) as pago, "
            + "coalesce(sum(case when c.situacao = :aberta then c.valorCentavos else 0L end), 0L) as emAberto, "
            + "coalesce(sum(case when c.situacao = :aberta and c.vencimento < :hoje then c.valorCentavos else 0L end), 0L) as vencido "
            + "from CobrancaAluno c join Aluno a on a.id = c.alunoId "
            + "left join ContratacaoAluno k on k.id = c.contratacaoId ";

    @Query("select c.contratacaoId as contratacaoId, c.alunoId as alunoId from CobrancaAluno c where c.id = :id")
    Optional<Referencias> referenciasDe(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CobrancaAluno c where c.id = :id")
    Optional<CobrancaAluno> buscarParaAlterar(UUID id);

    /**
     * Maior competência de todas as MENSALIDADES da contratação, canceladas incluídas. A cobrança de saída tem a data do
     * encerramento como competência e nunca entra na conta do calendário.
     */
    @Query("select max(c.competencia) from CobrancaAluno c where c.contratacaoId = :contratacaoId and c.tipo = :mensalidade")
    Optional<LocalDate> maiorCompetenciaDaMensalidade(UUID contratacaoId, CobrancaAluno.Tipo mensalidade);

    default Optional<LocalDate> maiorCompetencia(UUID contratacaoId) {
        return maiorCompetenciaDaMensalidade(contratacaoId, CobrancaAluno.Tipo.MENSALIDADE);
    }

    /** Maior competência da mensalidade fora das situações dadas (sem as que não cobrem período, dá o fim do último período em uso). */
    @Query("select max(c.competencia) from CobrancaAluno c where c.contratacaoId = :contratacaoId "
            + "and c.tipo = :mensalidade and c.situacao not in :excluidas")
    Optional<LocalDate> maiorCompetenciaCobertaDaMensalidade(UUID contratacaoId, CobrancaAluno.Tipo mensalidade,
            Collection<CobrancaAluno.Situacao> excluidas);

    default Optional<LocalDate> maiorCompetenciaCoberta(UUID contratacaoId,
            Collection<CobrancaAluno.Situacao> excluidas) {
        return maiorCompetenciaCobertaDaMensalidade(contratacaoId, CobrancaAluno.Tipo.MENSALIDADE, excluidas);
    }

    /**
     * As mensalidades da contratação fora das situações dadas, em ordem fixa (vencimento, id). A versão com trava é a do
     * encerrar: todas numa consulta só, na ordem que evita deadlock entre duas operações sobre a mesma contratação.
     */
    @Query("select c from CobrancaAluno c where c.contratacaoId = :contratacaoId and c.tipo = :mensalidade "
            + "and c.situacao not in :excluidas order by c.vencimento asc, c.id asc")
    List<CobrancaAluno> mensalidadesDaContratacao(UUID contratacaoId, CobrancaAluno.Tipo mensalidade,
            Collection<CobrancaAluno.Situacao> excluidas);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CobrancaAluno c where c.contratacaoId = :contratacaoId and c.tipo = :mensalidade "
            + "and c.situacao not in :excluidas order by c.vencimento asc, c.id asc")
    List<CobrancaAluno> mensalidadesDaContratacaoTravadas(UUID contratacaoId, CobrancaAluno.Tipo mensalidade,
            Collection<CobrancaAluno.Situacao> excluidas);

    /**
     * Esquece o link das cobranças abertas da consultoria (a pagas, canceladas e as demais guardam o histórico). Serve para
     * quando a conta do recebimento online muda ou some: o link velho aponta para a conta antiga ou foi gerado com outra
     * regra (com ou sem chave). Update em lote, sem {@code versioned}: o link é metadado do provedor e não edição do
     * treinador (como {@code registrarLink}), então a versão da cobrança não sobe. O {@code @TenantId} filtra a consultoria.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update CobrancaAluno c set c.linkUrl = null, c.linkSlug = null, c.linkValorCentavos = null, "
            + "c.linkGeradoEm = null, c.linkValidoAte = null where c.situacao = :aberta")
    int esquecerLinksDasAbertas(CobrancaAluno.Situacao aberta);

    boolean existsByContratacaoIdAndCompetenciaAndTipo(UUID contratacaoId, LocalDate competencia, CobrancaAluno.Tipo tipo);

    boolean existsByContratacaoIdAndCompetenciaAndTipoAndSituacao(UUID contratacaoId, LocalDate competencia,
            CobrancaAluno.Tipo tipo, CobrancaAluno.Situacao situacao);

    default boolean existsMensalidade(UUID contratacaoId, LocalDate competencia) {
        return existsByContratacaoIdAndCompetenciaAndTipo(contratacaoId, competencia, CobrancaAluno.Tipo.MENSALIDADE);
    }

    default boolean existsMensalidadeNaSituacao(UUID contratacaoId, LocalDate competencia, CobrancaAluno.Situacao situacao) {
        return existsByContratacaoIdAndCompetenciaAndTipoAndSituacao(contratacaoId, competencia,
                CobrancaAluno.Tipo.MENSALIDADE, situacao);
    }

    List<CobrancaAluno> findByContratacaoIdAndTipoAndSituacaoAndVencimentoGreaterThanEqual(UUID contratacaoId,
            CobrancaAluno.Tipo tipo, CobrancaAluno.Situacao situacao, LocalDate vencimento);

    List<CobrancaAluno> findByAlunoIdAndSituacao(UUID alunoId, CobrancaAluno.Situacao situacao);

    List<CobrancaAluno> findByAlunoId(UUID alunoId);

    List<CobrancaAluno> findByAlunoIdAndSituacaoOrderByVencimentoAscIdAsc(UUID alunoId, CobrancaAluno.Situacao situacao);

    /** As 24 mais recentes (a avulsa, sem competência, entra pelo vencimento). */
    @Query("select c from CobrancaAluno c where c.alunoId = :alunoId and c.situacao in :situacoes "
            + "order by coalesce(c.competencia, c.vencimento) desc, c.id desc limit 24")
    List<CobrancaAluno> findTop24ByAlunoIdAndSituacaoInOrderByCompetenciaDescIdDesc(UUID alunoId,
            Collection<CobrancaAluno.Situacao> situacoes);

    long countByVencimentoBetween(LocalDate de, LocalDate ate);

    // ---- Listas ----

    /** Em aberto e vencidas: as mais antigas primeiro. */
    @Query(value = LINHA + FILTRO + "order by c.vencimento asc, c.id asc", countQuery = CONTAGEM + FILTRO)
    Page<LinhaDeCobranca> listarCrescente(boolean todas, CobrancaAluno.Situacao situacao, boolean soVencidas,
            LocalDate hoje, LocalDate de, LocalDate ate, UUID alunoId, UUID responsavelId, Pageable pagina);

    /** Pagas, canceladas e as demais: as mais recentes primeiro. */
    @Query(value = LINHA + FILTRO + "order by c.vencimento desc, c.id desc", countQuery = CONTAGEM + FILTRO)
    Page<LinhaDeCobranca> listarDecrescente(boolean todas, CobrancaAluno.Situacao situacao, boolean soVencidas,
            LocalDate hoje, LocalDate de, LocalDate ate, UUID alunoId, UUID responsavelId, Pageable pagina);

    /** A lista filtrada ({@link #FILTRO_DA_LISTA}), das mais antigas: só abertas e vencidas. */
    @Query(value = LINHA + FILTRO_DA_LISTA + "order by c.vencimento asc, c.id asc", countQuery = CONTAGEM_DA_LISTA + FILTRO_DA_LISTA)
    Page<LinhaDeCobranca> filtrarCrescente(boolean filtraSituacoes, Collection<CobrancaAluno.Situacao> situacoes,
            boolean soVencidas, CobrancaAluno.Situacao aberta, LocalDate hoje, LocalDate de, LocalDate ate, UUID alunoId,
            UUID responsavelId, UUID planoId, String forma, boolean busca, String nome, Instant emissaoDe, Instant emissaoAte,
            boolean filtraPagamento, LocalDate pagoDe, LocalDate pagoAte, Pageable pagina);

    /** A lista filtrada ({@link #FILTRO_DA_LISTA}), das mais recentes: as demais combinações. */
    @Query(value = LINHA + FILTRO_DA_LISTA + "order by c.vencimento desc, c.id desc", countQuery = CONTAGEM_DA_LISTA + FILTRO_DA_LISTA)
    Page<LinhaDeCobranca> filtrarDecrescente(boolean filtraSituacoes, Collection<CobrancaAluno.Situacao> situacoes,
            boolean soVencidas, CobrancaAluno.Situacao aberta, LocalDate hoje, LocalDate de, LocalDate ate, UUID alunoId,
            UUID responsavelId, UUID planoId, String forma, boolean busca, String nome, Instant emissaoDe, Instant emissaoAte,
            boolean filtraPagamento, LocalDate pagoDe, LocalDate pagoAte, Pageable pagina);

    @Query(LINHA + "where c.alunoId = :alunoId order by coalesce(c.competencia, c.vencimento) desc, c.id desc")
    List<LinhaDeCobranca> doAluno(UUID alunoId);

    @Query(LINHA + "where c.id = :id")
    Optional<LinhaDeCobranca> linha(UUID id);

    @Query(LINHA + "where c.vencimento between :de and :ate order by c.vencimento asc, c.id asc")
    List<LinhaDeCobranca> paraExportar(LocalDate de, LocalDate ate);

    /** As cobranças da consultoria entre os ids dados (id de outra consultoria some: o {@code @TenantId} filtra), no mesmo corte da exportação. */
    @Query(LINHA + "where c.id in :ids order by c.vencimento asc, c.id asc")
    List<LinhaDeCobranca> paraExportarPorIds(Collection<UUID> ids);

    /** Os totais do mesmo filtro da lista ({@link #FILTRO_DA_LISTA}), uma linha só; {@code fora} = situações que não entram. */
    @Query(TOTAIS + FILTRO_DA_LISTA + "and c.situacao not in :fora")
    TotaisDaLista totais(boolean filtraSituacoes, Collection<CobrancaAluno.Situacao> situacoes, boolean soVencidas,
            CobrancaAluno.Situacao aberta, CobrancaAluno.Situacao paga, Collection<CobrancaAluno.Situacao> fora,
            LocalDate hoje, LocalDate de, LocalDate ate, UUID alunoId, UUID responsavelId, UUID planoId, String forma,
            boolean busca, String nome, Instant emissaoDe, Instant emissaoAte, boolean filtraPagamento, LocalDate pagoDe,
            LocalDate pagoAte);

    // ---- Agregados (números e painel) ----

    /** Abertas por vencimento: a vencer, em atraso e os próximos 7 e 30 dias. */
    @Query("select sum(c.valorCentavos) as total, count(c) as quantidade from CobrancaAluno c "
            + "join Aluno a on a.id = c.alunoId where c.situacao = :aberta and c.vencimento between :de and :ate "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId)")
    Soma abertasPorVencimento(CobrancaAluno.Situacao aberta, LocalDate de, LocalDate ate, UUID responsavelId);

    /** Tudo o que foi cobrado no intervalo de vencimento, menos o cancelado: a base da inadimplência. */
    @Query("select sum(c.valorCentavos) as total, count(c) as quantidade from CobrancaAluno c "
            + "join Aluno a on a.id = c.alunoId where c.situacao <> :cancelada and c.vencimento between :de and :ate "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId)")
    Soma cobradoPorVencimento(CobrancaAluno.Situacao cancelada, LocalDate de, LocalDate ate, UUID responsavelId);

    @Query("select sum(c.valorCentavos) as total, count(c) as quantidade from CobrancaAluno c "
            + "join Aluno a on a.id = c.alunoId where c.situacao = :paga and c.pagoEm between :de and :ate "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId)")
    Soma pagasPorPagamento(CobrancaAluno.Situacao paga, LocalDate de, LocalDate ate, UUID responsavelId);

    /** Só o tipo dado: pagantes e valor médio contam mensalidade; a cobrança de saída entra em recebido, não aqui (P6). */
    @Query("select sum(c.valorCentavos) as total, count(c) as quantidade from CobrancaAluno c "
            + "join Aluno a on a.id = c.alunoId where c.situacao = :paga and c.tipo = :tipo and c.pagoEm between :de and :ate "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId)")
    Soma pagasPorPagamentoDoTipo(CobrancaAluno.Situacao paga, CobrancaAluno.Tipo tipo, LocalDate de, LocalDate ate,
            UUID responsavelId);

    @Query("select count(distinct c.alunoId) from CobrancaAluno c join Aluno a on a.id = c.alunoId "
            + "where c.situacao = :paga and c.tipo = :tipo and c.pagoEm between :de and :ate "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId)")
    long alunosQuePagaramDoTipo(CobrancaAluno.Situacao paga, CobrancaAluno.Tipo tipo, LocalDate de, LocalDate ate,
            UUID responsavelId);

    @Query("select extract(year from c.pagoEm) as ano, extract(month from c.pagoEm) as mes, "
            + "sum(c.valorCentavos) as total from CobrancaAluno c join Aluno a on a.id = c.alunoId "
            + "where c.situacao = :paga and c.pagoEm between :de and :ate "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId) "
            + "group by extract(year from c.pagoEm), extract(month from c.pagoEm)")
    List<SomaMensal> recebidoPorMes(CobrancaAluno.Situacao paga, LocalDate de, LocalDate ate, UUID responsavelId);

    @Query("select extract(year from c.vencimento) as ano, extract(month from c.vencimento) as mes, "
            + "sum(c.valorCentavos) as total from CobrancaAluno c join Aluno a on a.id = c.alunoId "
            + "where c.situacao = :aberta and c.vencimento between :de and :ate "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId) "
            + "group by extract(year from c.vencimento), extract(month from c.vencimento)")
    List<SomaMensal> previstoPorMes(CobrancaAluno.Situacao aberta, LocalDate de, LocalDate ate, UUID responsavelId);

    @Query("select c.forma as forma, count(c) as quantidade, sum(c.valorCentavos) as total from CobrancaAluno c "
            + "join Aluno a on a.id = c.alunoId where c.situacao = :paga and c.pagoEm between :de and :ate "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId) group by c.forma order by c.forma")
    List<PorForma> pagasPorForma(CobrancaAluno.Situacao paga, LocalDate de, LocalDate ate, UUID responsavelId);

    @Query("select p.id as planoId, p.nome as nome, count(c) as quantidade, sum(c.valorCentavos) as total "
            + "from CobrancaAluno c join Aluno a on a.id = c.alunoId "
            + "join ContratacaoAluno k on k.id = c.contratacaoId "
            + "join PlanoComercial p on p.id = k.planoComercialId "
            + "where c.situacao = :paga and c.pagoEm between :de and :ate "
            + "and (:responsavelId is null or a.responsavelId = :responsavelId) group by p.id, p.nome order by p.nome, p.id")
    List<PorPlano> pagasPorPlano(CobrancaAluno.Situacao paga, LocalDate de, LocalDate ate, UUID responsavelId);
}
