package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.inscricoes.InscricaoDtos.ModeloRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.ModeloResponse;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Respostas prontas para o WhatsApp da consultoria. Ler com {@code INSCRICAO_LER}, criar, alterar e excluir com
 * {@code INSCRICAO_ALTERAR}. Nome único (sem diferença de maiúsculas, 409 {@code MODELO_NOME_EM_USO}), versão na
 * alteração e na exclusão (409 {@code CONFLITO_EDICAO}), no máximo {@link #LIMITE} por consultoria (409
 * {@code MODELOS_LIMITE}). O texto nunca vai a log nem à auditoria.
 */
@Service
public class ModelosDeMensagemService {

    static final int LIMITE = 50;

    private final ModeloDeMensagemRepository modelos;

    public ModelosDeMensagemService(ModeloDeMensagemRepository modelos) {
        this.modelos = modelos;
    }

    @Transactional(readOnly = true)
    public List<ModeloResponse> listar() {
        return modelos.todos().stream().map(ModelosDeMensagemService::resposta).toList();
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_MODELO_CRIADO", entidade = "INSCRICAO_MODELO", resumo = "Criou uma resposta pronta.")
    public ModeloResponse criar(ModeloRequest r) {
        if (modelos.count() >= LIMITE) {
            throw new ConflictException("Limite de " + LIMITE + " respostas prontas. Exclua uma antes.", "MODELOS_LIMITE");
        }
        exigirNomeLivre(r.nome().trim(), null);
        return resposta(modelos.saveAndFlush(new ModeloDeMensagem(r.nome().trim(), r.texto().trim(), r.ordem())));
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_MODELO_ALTERADO", entidade = "INSCRICAO_MODELO", resumo = "Alterou uma resposta pronta.")
    public ModeloResponse alterar(UUID id, ModeloRequest r) {
        ModeloDeMensagem m = modelos.buscarParaAlterar(id).orElseThrow(ModelosDeMensagemService::naoEncontrado);
        exigirVersao(m, r.versao());
        exigirNomeLivre(r.nome().trim(), id);
        m.alterar(r.nome().trim(), r.texto().trim(), r.ordem());
        return resposta(modelos.saveAndFlush(m));
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_MODELO_EXCLUIDO", entidade = "INSCRICAO_MODELO", resumo = "Excluiu uma resposta pronta.")
    public void excluir(UUID id, Long versao) {
        ModeloDeMensagem m = modelos.buscarParaAlterar(id).orElseThrow(ModelosDeMensagemService::naoEncontrado);
        exigirVersao(m, versao);
        modelos.delete(m);
        modelos.flush();
    }

    private void exigirNomeLivre(String nome, UUID id) {
        if (modelos.nomeEmUso(nome, id)) {
            throw new ConflictException("Já existe uma resposta pronta com este nome.", "MODELO_NOME_EM_USO");
        }
    }

    private static void exigirVersao(ModeloDeMensagem m, Long versao) {
        if (versao == null || !versao.equals(m.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou esta resposta pronta. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    private static ModeloResponse resposta(ModeloDeMensagem m) {
        return new ModeloResponse(m.getId(), m.getNome(), m.getTexto(), m.getOrdem(), m.getVersao());
    }

    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Resposta pronta não encontrada.");
    }
}
