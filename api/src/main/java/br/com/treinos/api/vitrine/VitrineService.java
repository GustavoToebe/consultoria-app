package br.com.treinos.api.vitrine;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.vitrine.VitrineDtos.ItemDoAlunoResponse;
import br.com.treinos.api.vitrine.VitrineDtos.ItemPublicoResponse;
import br.com.treinos.api.vitrine.VitrineDtos.ItemRequest;
import br.com.treinos.api.vitrine.VitrineDtos.ItemResponse;
import br.com.treinos.api.vitrine.VitrineDtos.OrdemRequest;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Vitrine da consultoria (F1): a equipe cadastra, ordena e apaga os itens ({@code VITRINE_ALTERAR}) e o aluno vê só os ativos. Item
 * de outra consultoria some pelo filtro do tenant (404, também para o aluno). Alterar e apagar levam a {@code versao} (409
 * {@code CONFLITO_EDICAO}); no máximo {@link #LIMITE_DE_ITENS} por consultoria (409 {@code VITRINE_LIMITE}). Ordem de recusa:
 * 404, 409 de versão, 422. Criar e reordenar travam a consultoria (o teto e a ordem não perdem corrida). A auditoria leva um
 * resumo fixo: nunca nome, preço, cupom nem link.
 */
@Service
public class VitrineService {

    static final int LIMITE_DE_ITENS = 30;
    static final String CODIGO_INVALIDO = "VITRINE_ITEM_INVALIDO";

    private final VitrineItemRepository itens;
    private final VitrineItemFotoRepository fotos;
    private final ConsultoriaRepository consultorias;
    private final Auditoria auditoria;

    public VitrineService(VitrineItemRepository itens, VitrineItemFotoRepository fotos, ConsultoriaRepository consultorias,
                          Auditoria auditoria) {
        this.itens = itens;
        this.fotos = fotos;
        this.consultorias = consultorias;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<ItemResponse> listar() {
        return respostas(itens.todos());
    }

    /** Só os ativos, na ordem da vitrine. */
    @Transactional(readOnly = true)
    public List<ItemDoAlunoResponse> listarDoAluno() {
        List<VitrineItem> ativos = itens.ativos();
        Map<UUID, Instant> comFoto = fotosDe(ativos);
        LocalDate hoje = FaixaDeData.hoje();
        return ativos.stream().map(i -> new ItemDoAlunoResponse(i.getId(), i.getNome(), i.getDescricao(), i.getTipo(),
                i.getPrecoCentavos(), PrecoDaVitrine.vigente(i, hoje),
                PrecoDaVitrine.especialVigente(i.getPrecoEspecialCentavos(), i.getEspecialAte(), hoje) ? i.getEspecialAte() : null,
                i.getCupom(), i.getLinkUrl(), comFoto.containsKey(i.getId()), comFoto.get(i.getId()))).toList();
    }

    /** Os itens da página pública, na ordem da vitrine; roda dentro da consultoria que o código revelou (sem login). */
    @Transactional(readOnly = true)
    public List<ItemPublicoResponse> listarDaPaginaPublica() {
        List<VitrineItem> publicos = itens.daPaginaPublica();
        Map<UUID, Instant> comFoto = fotosDe(publicos);
        LocalDate hoje = FaixaDeData.hoje();
        return publicos.stream().map(i -> new ItemPublicoResponse(i.getId(), i.getNome(), i.getDescricao(), i.getPrecoCentavos(),
                PrecoDaVitrine.vigente(i, hoje),
                PrecoDaVitrine.especialVigente(i.getPrecoEspecialCentavos(), i.getEspecialAte(), hoje) ? i.getEspecialAte() : null,
                i.getCupom(), i.getLinkUrl(), comFoto.containsKey(i.getId()), comFoto.get(i.getId()))).toList();
    }

    /** O item como a equipe vê (a resposta da troca de foto). */
    @Transactional(readOnly = true)
    public ItemResponse buscar(UUID id) {
        VitrineItem item = itens.findById(id).orElseThrow(VitrineService::naoEncontrado);
        return resposta(item, fotosDe(List.of(item)).get(id), FaixaDeData.hoje());
    }

    @Transactional
    public ItemResponse criar(ItemRequest r) {
        ValidacaoDoItem.Valido v = validar(r);
        travarConsultoria();
        if (itens.count() >= LIMITE_DE_ITENS) {
            throw new ConflictException("A vitrine pode ter no máximo " + LIMITE_DE_ITENS + " itens. Apague um antes.",
                    "VITRINE_LIMITE");
        }
        VitrineItem item = itens.saveAndFlush(new VitrineItem(v, itens.maiorOrdem() + 1));
        auditoria.registrarEvento("VITRINE_ITEM_CRIADO", "VITRINE_ITEM", item.getId(), "Criou um item da vitrine.");
        return resposta(item, null, FaixaDeData.hoje());
    }

    @Transactional
    public ItemResponse alterar(UUID id, ItemRequest r) {
        VitrineItem item = itens.buscarParaAlterar(id).orElseThrow(VitrineService::naoEncontrado);
        exigirVersao(item, r.versao());
        item.alterar(validar(r));
        itens.saveAndFlush(item);
        auditoria.registrarEvento("VITRINE_ITEM_ALTERADO", "VITRINE_ITEM", id, "Alterou um item da vitrine.");
        return resposta(item, fotosDe(List.of(item)).get(id), FaixaDeData.hoje());
    }

    @Transactional
    public void excluir(UUID id, Long versao) {
        VitrineItem item = itens.buscarParaAlterar(id).orElseThrow(VitrineService::naoEncontrado);
        exigirVersao(item, versao);
        itens.delete(item);
        itens.flush();
        auditoria.registrarEvento("VITRINE_ITEM_EXCLUIDO", "VITRINE_ITEM", id, "Excluiu um item da vitrine.");
    }

    /**
     * Grava a ordem que a tela mandou (Subir/Descer é conta do app): {@code ids} com todos os itens, uma vez cada, senão 422
     * (lista malformada) ou 409 {@code CONFLITO_EDICAO} (item criado ou apagado por outra pessoa enquanto a tela olhava). Os
     * lugares são renumerados de 0 a N-1; ordem igual à gravada não muda nada nem audita.
     */
    @Transactional
    public void ordenar(OrdemRequest r) {
        List<UUID> ids = r.ids();
        if (ids == null || ids.contains(null) || new HashSet<>(ids).size() != ids.size()) {
            throw new ValidacaoException("Confira os dados do item.", CODIGO_INVALIDO,
                    List.of(new ApiError.FieldError("ids", "Envie cada item uma única vez.")));
        }
        travarConsultoria();
        List<VitrineItem> lista = itens.todosParaAlterar();
        Map<UUID, VitrineItem> porId = new HashMap<>();
        lista.forEach(i -> porId.put(i.getId(), i));
        if (!porId.keySet().equals(new HashSet<>(ids))) {
            throw new ConflictException("A vitrine mudou enquanto você olhava. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
        boolean mudou = false;
        for (int k = 0; k < ids.size(); k++) {
            VitrineItem item = porId.get(ids.get(k));
            if (item.getOrdem() != k) {
                item.ordenarEm(k);
                mudou = true;
            }
        }
        if (mudou) {
            itens.flush();
            auditoria.registrarEvento("VITRINE_ITEM_ORDEM_ALTERADA", "VITRINE_ITEM", null, "Mudou a ordem dos itens da vitrine.");
        }
    }

    private ValidacaoDoItem.Valido validar(ItemRequest r) {
        List<ApiError.FieldError> problemas = ValidacaoDoItem.problemas(r, FaixaDeData.hoje());
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira os dados do item.", CODIGO_INVALIDO, problemas);
        }
        return ValidacaoDoItem.normalizar(r);
    }

    private List<ItemResponse> respostas(List<VitrineItem> lista) {
        Map<UUID, Instant> comFoto = fotosDe(lista);
        LocalDate hoje = FaixaDeData.hoje();
        return lista.stream().map(i -> resposta(i, comFoto.get(i.getId()), hoje)).toList();
    }

    private static ItemResponse resposta(VitrineItem i, Instant fotoAtualizadaEm, LocalDate hoje) {
        return new ItemResponse(i.getId(), i.getNome(), i.getDescricao(), i.getTipo(), i.getPrecoCentavos(),
                i.getPrecoEspecialCentavos(), i.getEspecialAte(), PrecoDaVitrine.vigente(i, hoje), i.getCupom(), i.getLinkUrl(),
                i.isAtivo(), i.isNaPaginaPublica(), i.getOrdem(), i.getVersao(), fotoAtualizadaEm != null, fotoAtualizadaEm);
    }

    /** Quando cada item teve a foto trocada (só os que têm), numa consulta e sem os bytes. */
    private Map<UUID, Instant> fotosDe(Collection<VitrineItem> lista) {
        Map<UUID, Instant> mapa = new HashMap<>();
        if (!lista.isEmpty()) {
            fotos.atualizadas(lista.stream().map(VitrineItem::getId).toList()).forEach(f -> mapa.put(f.itemId(), f.atualizadaEm()));
        }
        return mapa;
    }

    private void travarConsultoria() {
        if (consultorias.travar(TenantContext.get()).isEmpty()) {
            throw new NaoEncontradoException("Consultoria não encontrada.");
        }
    }

    private static void exigirVersao(VitrineItem item, Long versao) {
        if (versao == null || !versao.equals(item.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou este item. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Item da vitrine não encontrado.");
    }
}
