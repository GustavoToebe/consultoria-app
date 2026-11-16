package br.com.treinos.api.vitrine;

import br.com.treinos.api.consultoria.MarcaPublica;
import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.vitrine.VitrineDtos.ItemDoMarketplace;
import br.com.treinos.api.vitrine.VitrineDtos.ItemPublicoResponse;
import br.com.treinos.api.vitrine.VitrineDtos.LojaDoMarketplace;
import br.com.treinos.api.vitrine.VitrineDtos.LojaPublicaResponse;
import br.com.treinos.api.vitrine.VitrineDtos.MarcaDaLoja;
import br.com.treinos.api.vitrine.VitrineDtos.MarketplaceResponse;
import br.com.treinos.api.vitrine.VitrinePublicaRepositorio.LojaDoBanco;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Página pública da loja (F2a, sem login, só leitura). O código do caminho descobre a consultoria
 * ({@link VitrinePublicaRepositorio}); o resto roda dentro dela. Código fora do formato, inexistente e página desligada dão o mesmo
 * 404 (nada revela qual); a loja desligada na plataforma é o 503 do {@link ExigeLoja}. Sem transação aqui: cada leitura abre a sua dentro da consultoria.
 */
@Service
public class VitrinePublicaService {

    static final int TAMANHO_PADRAO = 30;
    static final int TAMANHO_MAXIMO = 100;
    /** Acima disto a página já está além de qualquer lista real; o corte evita conta com número absurdo, sem erro. */
    static final int PAGINA_MAXIMA = 1_000_000;

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

    /**
     * Lista pública de lojas (F3, sem login, só leitura): quem entrou no marketplace, com a página ligada, sem estar suspensa e com
     * itens que também entraram ({@link VitrinePublicaRepositorio#marketplace}). Paginada por loja, base 0: {@code tamanho} fica
     * entre 1 e {@value #TAMANHO_MAXIMO} (padrão {@value #TAMANHO_PADRAO}), {@code pagina} negativa vira 0 e acima de
     * {@value #PAGINA_MAXIMA} vira lista vazia com o total real. Preço vigente pelo dia de Brasília, decidido aqui.
     */
    public MarketplaceResponse marketplace(Long pagina, Long tamanho) {
        int tam = tamanho == null ? TAMANHO_PADRAO : (int) Math.max(1, Math.min(tamanho, TAMANHO_MAXIMO));
        int pag = pagina == null ? 0 : (int) Math.max(0, Math.min(pagina, PAGINA_MAXIMA));
        LocalDate hoje = FaixaDeData.hoje();
        VitrinePublicaRepositorio.PaginaDoBanco lida = busca.marketplace(pag, tam);
        List<LojaDoMarketplace> lojas = lida.lojas().stream().map(l -> loja(l, hoje)).toList();
        return new MarketplaceResponse(lojas, lida.total(), pag, tam);
    }

    private static LojaDoMarketplace loja(LojaDoBanco l, LocalDate hoje) {
        MarcaDaLoja marca = new MarcaDaLoja(l.nome(), l.corPrimaria(), l.fonteTitulo(), l.temaPadrao(),
                MarcaPublica.logoUrl(l.consultoriaId(), l.logoTipo(), l.logoVersao()));
        List<ItemDoMarketplace> itens = l.itens().stream().map(i -> new ItemDoMarketplace(i.id(), i.nome(), i.descricao(), i.tipo(),
                PrecoDaVitrine.vigente(i.precoCentavos(), i.precoEspecialCentavos(), i.especialAte(), hoje),
                i.fotoAtualizadaEm() != null, i.fotoAtualizadaEm())).toList();
        return new LojaDoMarketplace(marca, l.codigo(), itens);
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
