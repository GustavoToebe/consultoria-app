package br.com.treinos.api.pagamentos;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface LancamentoFinanceiroRepository extends JpaRepository<LancamentoFinanceiro, UUID> {

    interface SomaMensal {
        Integer getAno();

        Integer getMes();

        TipoDeLancamento getTipo();

        Long getTotal();
    }

    /**
     * A lista filtrada (lote 2 dos filtros): período, tipo ({@code null} = os dois), categorias (comparadas em minúsculas;
     * {@code filtraCategorias} liga, e a coleção nunca vai vazia) e busca na descrição ({@code texto} é o padrão do LIKE).
     */
    @Query(value = "select l from LancamentoFinanceiro l where " + FILTRO
            + "order by l.data desc, l.criadoEm desc, l.id desc",
            countQuery = "select count(l) from LancamentoFinanceiro l where " + FILTRO)
    Page<LancamentoFinanceiro> filtrar(LocalDate de, LocalDate ate, TipoDeLancamento tipo, boolean filtraCategorias,
                                       Collection<String> categorias, boolean busca, String texto, Pageable pagina);

    String FILTRO = "l.data between :de and :ate and (:tipo is null or l.tipo = :tipo) "
            + "and (:filtraCategorias = false or lower(l.categoria) in :categorias) "
            + "and (:busca = false or lower(l.descricao) like :texto escape '\\') ";

    /** As categorias já usadas (para o filtro), em ordem alfabética; até 200. */
    @Query("select distinct l.categoria from LancamentoFinanceiro l where l.categoria is not null order by l.categoria")
    List<String> categorias(Pageable limite);

    List<LancamentoFinanceiro> findByDataBetweenOrderByDataAscCriadoEmAscIdAsc(LocalDate de, LocalDate ate);

    long countByDataBetween(LocalDate de, LocalDate ate);

    @Query("select extract(year from l.data) as ano, extract(month from l.data) as mes, l.tipo as tipo, "
            + "sum(l.valorCentavos) as total from LancamentoFinanceiro l where l.data between :de and :ate "
            + "group by extract(year from l.data), extract(month from l.data), l.tipo")
    List<SomaMensal> somaPorMes(LocalDate de, LocalDate ate);
}
