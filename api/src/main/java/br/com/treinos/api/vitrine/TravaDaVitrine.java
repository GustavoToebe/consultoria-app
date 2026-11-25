package br.com.treinos.api.vitrine;

import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Component;

/**
 * Trava da consultoria da sessão para toda escrita da vitrine (itens, fotos e categorias). A regra de ordem: a consultoria
 * sempre antes da linha do item ou da categoria, em todo caminho que escreve, então duas escritas nunca se esperam em ordem
 * trocada (sem deadlock). Precisa de transação aberta.
 */
@Component
class TravaDaVitrine {

    private final ConsultoriaRepository consultorias;

    TravaDaVitrine(ConsultoriaRepository consultorias) {
        this.consultorias = consultorias;
    }

    void travar() {
        if (consultorias.travar(TenantContext.get()).isEmpty()) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
    }
}
