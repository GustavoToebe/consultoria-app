package br.com.treinos.api.pagamentos;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Toda consulta sai filtrada pela consultoria da sessão ({@code @TenantId}). */
public interface PlanoComercialRepository extends JpaRepository<PlanoComercial, UUID> {

    @Query("select p from PlanoComercial p where (:incluirArquivados = true or p.arquivadoEm is null) "
            + "order by lower(p.nome), p.id")
    List<PlanoComercial> listar(boolean incluirArquivados);

    /** O produto da Kiwify já está em outro plano NÃO arquivado ({@code ignorar} é o próprio plano na edição). */
    @Query("select count(p) > 0 from PlanoComercial p where p.kiwifyProdutoId = :produto and p.arquivadoEm is null "
            + "and (:ignorar is null or p.id <> :ignorar)")
    boolean produtoDaKiwifyEmUso(String produto, UUID ignorar);

    /**
     * Os planos da consultoria com o produto da venda da Kiwify, ARQUIVADOS INCLUÍDOS (a conciliação nunca ignora dinheiro
     * recebido de um plano que foi arquivado; só o não arquivado é único pelo índice parcial).
     */
    @Query("select p.id from PlanoComercial p where p.kiwifyProdutoId = :produto")
    List<UUID> idsDoProdutoDaKiwify(String produto);

    /** Quais destas contratações são de plano com assinatura pela Kiwify (para marcar as mensalidades "automáticas"). */
    @Query("select k.id from ContratacaoAluno k join PlanoComercial p on p.id = k.planoComercialId "
            + "where k.id in :contratacoes and p.kiwifyAssinatura = true")
    List<UUID> contratacoesComAssinaturaDaKiwify(Collection<UUID> contratacoes);

    /** Nome repetido entre os não arquivados (sem diferença de maiúsculas); {@code ignorar} é o próprio plano na edição. */
    @Query("select count(p) > 0 from PlanoComercial p where lower(p.nome) = lower(:nome) and p.arquivadoEm is null "
            + "and (:ignorar is null or p.id <> :ignorar)")
    boolean nomeEmUso(String nome, UUID ignorar);
}
