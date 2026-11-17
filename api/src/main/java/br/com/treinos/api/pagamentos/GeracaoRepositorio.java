package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Consultas da geração mensal das cobranças. JPQL sempre: dentro de uma consultoria o {@code @TenantId} filtra; só a lista de
 * consultorias é global ({@code Consultoria} não tem tenant: é a raiz do isolamento).
 */
interface GeracaoRepositorio extends Repository<CobrancaAluno, UUID> {

    /** O maior vencimento das mensalidades da contratação, canceladas incluídas (a saída tem outra data e fica de fora). */
    @Query("select max(c.vencimento) from CobrancaAluno c where c.contratacaoId = :contratacaoId and c.tipo = :mensalidade")
    Optional<LocalDate> maiorVencimentoDaMensalidade(UUID contratacaoId, CobrancaAluno.Tipo mensalidade);

    /** Os ids de todas as consultorias, para a rotina entrar em cada uma com o {@code TenantContext}. */
    @Query("select c.id from Consultoria c order by c.id")
    List<UUID> consultoriasDaRotina();
}
