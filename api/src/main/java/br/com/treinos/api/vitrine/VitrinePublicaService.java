package br.com.treinos.api.vitrine;

import br.com.treinos.api.consultoria.MarcaPublica;
import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.vitrine.VitrineDtos.ItemPublicoResponse;
import br.com.treinos.api.vitrine.VitrineDtos.LojaPublicaResponse;
import br.com.treinos.api.vitrine.VitrineDtos.MarcaDaLoja;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Página pública da loja (F2a, sem login, só leitura). O código do caminho descobre a consultoria
 * ({@link VitrinePublicaRepositorio}); o resto roda dentro dela. Código fora do formato, inexistente e página desligada dão o mesmo
 * 404 (nada revela qual); a loja desligada na plataforma é o 503 do {@link ExigeLoja}. Sem transação aqui: cada leitura abre a sua dentro da consultoria.
 */
@Service
public class VitrinePublicaService {

    private final VitrinePublicaRepositorio busca;
    private final VitrineService vitrine;
    private final FotosDaVitrineService fotos;
    private final MarcaService marcas;

    public VitrinePublicaService(VitrinePublicaRepositorio busca, VitrineService vitrine, FotosDaVitrineService fotos, MarcaService marcas) {
        this.busca = busca;
        this.vitrine = vitrine;
        this.fotos = fotos;
        this.marcas = marcas;
    }

    public LojaPublicaResponse pagina(String codigo) {
        UUID consultoriaId = consultoriaDaPagina(codigo);
        MarcaPublica m = marcas.marca(consultoriaId);
        List<ItemPublicoResponse> itens = TenantContext.executarComo(consultoriaId, vitrine::listarDaPaginaPublica);
        return new LojaPublicaResponse(new MarcaDaLoja(m.nome(), m.corPrimaria(), m.fonteTitulo(), m.temaPadrao(), m.logoUrl()), itens);
    }

    public byte[] foto(String codigo, UUID itemId) {
        UUID consultoriaId = consultoriaDaPagina(codigo);
        return TenantContext.executarComo(consultoriaId, () -> fotos.lerDaPaginaPublica(itemId));
    }

    private UUID consultoriaDaPagina(String codigo) {
        return busca.consultoriaDaPaginaLigada(codigo).orElseThrow(VitrinePublicaService::paginaNaoEncontrada);
    }

    static NaoEncontradoException paginaNaoEncontrada() {
        return new NaoEncontradoException("Página não encontrada.");
    }
}
