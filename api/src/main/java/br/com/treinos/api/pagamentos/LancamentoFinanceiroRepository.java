package br.com.treinos.api.pagamentos;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
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

    Page<LancamentoFinanceiro> findByDataBetweenOrderByDataDescCriadoEmDescIdDesc(LocalDate de, LocalDate ate, Pageable pagina);

    List<LancamentoFinanceiro> findByDataBetweenOrderByDataAscCriadoEmAscIdAsc(LocalDate de, LocalDate ate);

    long countByDataBetween(LocalDate de, LocalDate ate);

    @Query("select extract(year from l.data) as ano, extract(month from l.data) as mes, l.tipo as tipo, "
            + "sum(l.valorCentavos) as total from LancamentoFinanceiro l where l.data between :de and :ate "
            + "group by extract(year from l.data), extract(month from l.data), l.tipo")
    List<SomaMensal> somaPorMes(LocalDate de, LocalDate ate);
}
