package br.com.treinos.api.vitrine;

import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.fotos.FotoException;
import br.com.treinos.api.fotos.JpegSemMetadados;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Foto do item da vitrine (D3): só sobre item que já existe, uma por item. Só JPEG, regravado sem metadados (1600 px, 300 KB depois
 * da limpeza) e guardado no banco; sai só pela API, com {@code no-store}. Teto de {@value #POR_DIA} envios por consultoria em 24 h,
 * num contador atômico no banco (apagar ou trocar não devolve cota). Recusa: 404 (item de outra consultoria, inexistente ou, para
 * o aluno, inativo ou sem foto), depois 422 do arquivo ({@code FOTO_INVALIDA}, {@code FOTO_GRANDE_DEMAIS}) e do teto
 * ({@code FOTOS_LIMITE_DIARIO}); o arquivo inválido não gasta cota.
 */
@Service
public class FotosDaVitrineService {

    static final int BYTES_MAXIMO = 300_000;
    static final int LADO_MAXIMO = 1600;
    static final int POR_DIA = 100;

    private final VitrineItemRepository itens;
    private final VitrineItemFotoRepository fotos;
    private final LimiteTentativas limite;
    private final Auditoria auditoria;

    public FotosDaVitrineService(VitrineItemRepository itens, VitrineItemFotoRepository fotos, LimiteTentativas limite,
                                 Auditoria auditoria) {
        this.itens = itens;
        this.fotos = fotos;
        this.limite = limite;
        this.auditoria = auditoria;
    }

    /** A permissão ({@code VITRINE_ALTERAR}) é conferida na rota. */
    @Transactional
    public Instant gravar(UUID itemId, byte[] recebido) {
        if (itens.buscarParaAlterar(itemId).isEmpty()) {
            throw VitrineService.naoEncontrado();
        }
        byte[] jpeg = limpar(recebido);
        if (!limite.fotoDaVitrineCabe(Objects.requireNonNull(TenantContext.get()), POR_DIA)) {
            throw FotoException.limiteDoDia();
        }
        VitrineItemFoto foto = fotos.findById(itemId).orElseGet(() -> new VitrineItemFoto(itemId));
        foto.trocar(jpeg, Instant.now());
        Instant quando = fotos.saveAndFlush(foto).getAtualizadaEm();
        auditoria.registrarEvento("VITRINE_ITEM_FOTO_ALTERADA", "VITRINE_ITEM", itemId, "Trocou a foto de um item da vitrine.");
        return quando;
    }

    /** Idempotente: sem foto, não faz nada nem audita; item de outra consultoria = 404. */
    @Transactional
    public void remover(UUID itemId) {
        if (itens.buscarParaAlterar(itemId).isEmpty()) {
            throw VitrineService.naoEncontrado();
        }
        Optional<VitrineItemFoto> existente = fotos.findById(itemId);
        if (existente.isPresent()) {
            fotos.delete(existente.get());
            fotos.flush();
            auditoria.registrarEvento("VITRINE_ITEM_FOTO_REMOVIDA", "VITRINE_ITEM", itemId, "Removeu a foto de um item da vitrine.");
        }
    }

    /** A permissão ({@code VITRINE_LER}) é conferida na rota. */
    @Transactional(readOnly = true)
    public byte[] lerDaEquipe(UUID itemId) {
        return fotos.findById(itemId).map(VitrineItemFoto::getJpeg).orElseThrow(FotosDaVitrineService::semFoto);
    }

    /** O aluno só vê a foto de item ativo; inativo, inexistente, de outra consultoria e sem foto dão o mesmo 404. */
    @Transactional(readOnly = true)
    public byte[] lerDoAluno(UUID itemId) {
        if (itens.findById(itemId).filter(VitrineItem::isAtivo).isEmpty()) {
            throw semFoto();
        }
        return lerDaEquipe(itemId);
    }

    /** Página pública: só a foto de item ativo, DIGITAL e marcado; qualquer outro caso dá o mesmo 404. */
    @Transactional(readOnly = true)
    public byte[] lerDaPaginaPublica(UUID itemId) {
        if (itens.daPaginaPublicaPorId(itemId).isEmpty()) {
            throw semFoto();
        }
        return lerDaEquipe(itemId);
    }

    private static NaoEncontradoException semFoto() {
        return new NaoEncontradoException("Foto não encontrada.");
    }

    private static byte[] limpar(byte[] recebido) {
        if (recebido == null || recebido.length == 0) {
            throw FotoException.invalida();
        }
        if (recebido.length > 4 * BYTES_MAXIMO) {
            throw FotoException.grandeDemais();
        }
        byte[] limpo;
        try {
            limpo = JpegSemMetadados.limpar(recebido, LADO_MAXIMO);
        } catch (IllegalArgumentException e) {
            throw FotoException.invalida();
        }
        if (limpo.length > BYTES_MAXIMO) {
            throw FotoException.grandeDemais();
        }
        return limpo;
    }
}
