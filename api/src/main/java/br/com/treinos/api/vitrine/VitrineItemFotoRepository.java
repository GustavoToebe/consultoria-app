package br.com.treinos.api.vitrine;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Fotos dos itens da consultoria da sessão ({@code @TenantId}). */
public interface VitrineItemFotoRepository extends JpaRepository<VitrineItemFoto, UUID> {

    @Query("select new br.com.treinos.api.vitrine.FotoDoItem(f.itemId, f.atualizadaEm) from VitrineItemFoto f where f.itemId in :itemIds")
    List<FotoDoItem> atualizadas(Collection<UUID> itemIds);
}
