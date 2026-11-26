package br.com.treinos.api.contratos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.contratos.ContratoDtos.ArquivarModeloRequest;
import br.com.treinos.api.contratos.ContratoDtos.ModeloRequest;
import br.com.treinos.api.contratos.ContratoDtos.ModeloResponse;
import br.com.treinos.api.contratos.ContratoDtos.PreviaDoModelo;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Modelos de contrato da consultoria (D4a, D9). O texto só aceita os campos da lista fechada: o desconhecido é 422 sem repetir o
 * texto. Nome único entre os ativos (409), edição com {@code versao} (409 {@code CONFLITO_EDICAO}); o modelo nunca se apaga, só se
 * arquiva. Nada do texto vai a log nem à auditoria (resumos fixos, só quando algo muda).
 */
@Service
public class ContratoModeloService {

    static final int NOME_MAXIMO = 80;
    static final int TEXTO_MAXIMO = 50_000;
    private static final UUID NINGUEM = new UUID(0L, 0L);

    private final ContratoModeloRepository modelos;
    private final Auditoria auditoria;

    public ContratoModeloService(ContratoModeloRepository modelos, Auditoria auditoria) {
        this.modelos = modelos;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<ModeloResponse> listar() {
        return modelos.todosEmOrdem().stream().map(ContratoModeloService::resposta).toList();
    }

    @Transactional
    public ModeloResponse criar(ModeloRequest r) {
        Dados d = validar(r);
        if (modelos.nomeEmUso(d.nome(), NINGUEM)) {
            throw nomeEmUso();
        }
        ContratoModelo novo;
        try {
            novo = modelos.saveAndFlush(new ContratoModelo(d.nome(), d.texto(), agora()));
        } catch (DataIntegrityViolationException e) {
            throw traduzir(e);
        }
        auditoria.registrarEvento("CONTRATO_MODELO_CRIADO", "CONTRATO_MODELO", novo.getId(), "Criou um modelo de contrato.");
        return resposta(novo);
    }

    /** {@code versao} obrigatória (ausente ou velha = 409 {@code CONFLITO_EDICAO}). Modelo arquivado não se edita. Igual ao gravado = 200 sem auditoria. */
    @Transactional
    public ModeloResponse alterar(UUID id, ModeloRequest r) {
        ContratoModelo m = modelos.findById(id).orElseThrow(ContratoModeloService::naoEncontrado);
        Dados d = validar(r);
        if (r.versao() == null || !r.versao().equals(m.getVersao())) {
            throw conflitoDeEdicao();
        }
        if (m.isArquivado()) {
            throw new ConflictException("Este modelo está arquivado e não pode mais ser editado.", "CONTRATO_MODELO_ARQUIVADO");
        }
        if (modelos.nomeEmUso(d.nome(), id)) {
            throw nomeEmUso();
        }
        boolean mudou = m.alterar(d.nome(), d.texto(), agora());
        try {
            m = modelos.saveAndFlush(m);
        } catch (DataIntegrityViolationException e) {
            throw traduzir(e);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw conflitoDeEdicao();
        }
        if (mudou) {
            auditoria.registrarEvento("CONTRATO_MODELO_ALTERADO", "CONTRATO_MODELO", id, "Alterou um modelo de contrato.");
        }
        return resposta(m);
    }

    /** Arquivar o que já está arquivado é 200 sem auditoria; o nome fica livre para outro modelo ativo. */
    @Transactional
    public ModeloResponse arquivar(UUID id, ArquivarModeloRequest r) {
        ContratoModelo m = modelos.findById(id).orElseThrow(ContratoModeloService::naoEncontrado);
        if (m.isArquivado()) {
            return resposta(m);
        }
        if (r.versao() == null || !r.versao().equals(m.getVersao())) {
            throw conflitoDeEdicao();
        }
        m.arquivar(agora());
        try {
            m = modelos.saveAndFlush(m);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw conflitoDeEdicao();
        }
        auditoria.registrarEvento("CONTRATO_MODELO_ARQUIVADO", "CONTRATO_MODELO", id, "Arquivou um modelo de contrato.");
        return resposta(m);
    }

    /** O modelo preenchido com dados fictícios (só leitura, sem auditoria). */
    @Transactional(readOnly = true)
    public PreviaDoModelo previa(UUID id) {
        ContratoModelo m = modelos.findById(id).orElseThrow(ContratoModeloService::naoEncontrado);
        return new PreviaDoModelo(m.getNome(), CamposDoContrato.preencher(m.getTexto(), CamposDoContrato.exemplo()));
    }

    /** O modelo ativo para gerar contrato: de outra consultoria ou inexistente = 404; arquivado = 409. */
    ContratoModelo ativoOuErro(UUID id) {
        ContratoModelo m = modelos.findById(id).orElseThrow(ContratoModeloService::naoEncontrado);
        if (m.isArquivado()) {
            throw new ConflictException("Este modelo está arquivado.", "CONTRATO_MODELO_ARQUIVADO");
        }
        return m;
    }

    // ---- validação (mensagens fixas: o texto digitado nunca é repetido) ----

    private record Dados(String nome, String texto) {
        @Override
        public String toString() {
            return "Dados[...]";
        }
    }

    private static Dados validar(ModeloRequest r) {
        List<ApiError.FieldError> problemas = new ArrayList<>();
        String nome = r.nome() == null ? "" : r.nome().strip();
        if (nome.isEmpty()) {
            problemas.add(new ApiError.FieldError("nome", "Informe o nome do modelo."));
        } else if (nome.length() > NOME_MAXIMO) {
            problemas.add(new ApiError.FieldError("nome", "O nome pode ter até " + NOME_MAXIMO + " caracteres."));
        }
        String texto = r.texto() == null ? "" : TextoDoContrato.normalizar(r.texto());
        if (texto.isBlank()) {
            problemas.add(new ApiError.FieldError("texto", "Escreva o texto do contrato."));
        } else if (texto.length() > TEXTO_MAXIMO) {
            problemas.add(new ApiError.FieldError("texto", "O texto pode ter até 50.000 caracteres."));
        } else {
            int desconhecidos = CamposDoContrato.desconhecidos(texto);
            if (desconhecidos > 0) {
                problemas.add(new ApiError.FieldError("texto", "O texto tem " + desconhecidos
                        + (desconhecidos == 1 ? " campo desconhecido" : " campos desconhecidos") + ". Use só os campos da lista."));
            }
        }
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira o modelo de contrato.", "CONTRATO_MODELO_INVALIDO", problemas);
        }
        return new Dados(nome, texto);
    }

    private static ModeloResponse resposta(ContratoModelo m) {
        return new ModeloResponse(m.getId(), m.getNome(), m.getTexto(), m.getArquivadoEm(), m.getVersao(), m.getAtualizadoEm());
    }

    private static Instant agora() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    private static RuntimeException traduzir(DataIntegrityViolationException e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c
                    && "ux_contrato_modelo_nome".equals(c.getConstraintName())) {
                return nomeEmUso();
            }
        }
        return e;
    }

    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Modelo de contrato não encontrado.");
    }

    private static ConflictException nomeEmUso() {
        return new ConflictException("Já existe um modelo ativo com este nome.", "CONTRATO_MODELO_NOME_EM_USO");
    }

    private static ConflictException conflitoDeEdicao() {
        return new ConflictException("Outra pessoa ou aba alterou este modelo. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
    }
}
