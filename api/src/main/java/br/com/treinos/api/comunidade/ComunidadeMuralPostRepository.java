package br.com.treinos.api.comunidade;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.UUID;

public interface ComunidadeMuralPostRepository extends JpaRepository<ComunidadeMuralPost, UUID> {

    /**
     * O mural visível: fixados primeiro, depois os mais novos. {@code tipo} vazio = todos; {@code busca} é o padrão de LIKE já sem
     * acento ({@code Buscas.padraoSemAcento}, {@code %} = tudo); {@code soDenunciados} (só a equipe) deixa os que têm denúncia.
     */
    @Query("select p from ComunidadeMuralPost p where p.oculto = false and (:tipo = '' or p.tipo = :tipo) "
            + "and p.textoBusca like :busca escape '\\' "
            + "and (:soDenunciados = false or exists (select 1 from ComunidadeMuralDenuncia d where d.postId = p.id)) "
            + "order by p.fixado desc, p.criadoEm desc, p.id desc")
    Page<ComunidadeMuralPost> mural(String tipo, String busca, boolean soDenunciados, Pageable pageable);

    /** Exportação LGPD: o que o usuário publicou, inclusive o que a moderação ocultou. */
    List<ComunidadeMuralPost> findTop5000ByAutorIdOrderByCriadoEmDesc(UUID autorId);
}
