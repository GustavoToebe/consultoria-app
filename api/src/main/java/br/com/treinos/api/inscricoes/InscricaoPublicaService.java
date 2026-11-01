package br.com.treinos.api.inscricoes;

import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoPublica;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoPublicaRequest;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Rotas públicas do link de inscrição. Sem transação aqui: primeiro descobre a consultoria pelo código
 * ({@link InscricaoBusca}, só links abertos), depois roda a leitura ou a gravação com ela no {@link TenantContext} (a
 * transação abre dentro do bloco, então o Hibernate já filtra e preenche a consultoria certa). Código inexistente ou
 * link desligado: o mesmo 404, sem dizer qual.
 */
@Service
public class InscricaoPublicaService {

    private final InscricaoBusca busca;
    private final InscricaoService inscricoes;
    private final MarcaService marcas;

    public InscricaoPublicaService(InscricaoBusca busca, InscricaoService inscricoes, MarcaService marcas) {
        this.busca = busca;
        this.inscricoes = inscricoes;
        this.marcas = marcas;
    }

    public InscricaoPublica consultar(String codigo) {
        UUID consultoriaId = busca.consultoriaDoLinkAberto(codigo).orElseThrow(InscricaoPublicaService::linkInvalido);
        InscricaoService.PaginaDoLink pagina = TenantContext.executarComo(consultoriaId, () -> inscricoes.paginaDoLink(codigo));
        return new InscricaoPublica(marcas.marca(consultoriaId), pagina.texto(), TextoDaInscricao.versao(pagina.texto()), true,
                pagina.campos(), pagina.perguntas());
    }

    public void inscrever(String codigo, InscricaoPublicaRequest request) {
        UUID consultoriaId = busca.consultoriaDoLinkAberto(codigo).orElseThrow(InscricaoPublicaService::linkInvalido);
        TenantContext.executarComo(consultoriaId, () -> {
            inscricoes.registrarPublica(codigo, request);
            return null;
        });
    }

    static NaoEncontradoException linkInvalido() {
        return new NaoEncontradoException("Link de inscrição inválido ou encerrado. Peça o link atual à consultoria.");
    }
}
