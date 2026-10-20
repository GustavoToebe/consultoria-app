package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.PlanoResponse;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Os planos comerciais da consultoria (o que o treinador vende). Editar um plano não muda quem já contratou: a contratação
 * guarda o próprio valor e a própria periodicidade. Plano não se exclui, arquiva-se (some da lista de escolha, e o nome
 * volta a poder ser usado).
 */
@Service
public class PlanoComercialService {

    private final PlanoComercialRepository planos;
    private final Auditoria auditoria;

    public PlanoComercialService(PlanoComercialRepository planos, Auditoria auditoria) {
        this.planos = planos;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<PlanoResponse> listar(boolean incluirArquivados) {
        return planos.listar(incluirArquivados).stream().map(Respostas::plano).toList();
    }

    @Transactional
    @Auditar(acao = "PLANO_COMERCIAL_CRIADO", entidade = "PLANO_COMERCIAL", resumo = "Criou um plano comercial.")
    public PlanoResponse criar(PlanoRequest r) {
        String nome = r.nome().trim();
        exigirNomeLivre(nome, null);
        PlanoComercial plano = new PlanoComercial(nome, r.valorCentavos(), r.periodicidade());
        return Respostas.plano(gravar(plano));
    }

    @Transactional
    @Auditar(acao = "PLANO_COMERCIAL_ALTERADO", entidade = "PLANO_COMERCIAL", resumo = "Editou um plano comercial.")
    public PlanoResponse alterar(UUID id, PlanoRequest r) {
        PlanoComercial plano = buscar(id);
        if (plano.isArquivado()) {
            throw new ConflictException("Plano arquivado não é editado.", "PLANO_COMERCIAL_ARQUIVADO");
        }
        conferirVersao(plano, r.versao());
        String nome = r.nome().trim();
        exigirNomeLivre(nome, id);
        plano.alterar(nome, r.valorCentavos(), r.periodicidade());
        return Respostas.plano(gravar(plano));
    }

    /** Arquivar plano já arquivado devolve o plano como está (sem nova auditoria). */
    @Transactional
    public PlanoResponse arquivar(UUID id, Long versao) {
        PlanoComercial plano = buscar(id);
        if (plano.isArquivado()) {
            return Respostas.plano(plano);
        }
        conferirVersao(plano, versao);
        plano.arquivar(Instant.now());
        PlanoComercial gravado = gravar(plano);
        auditoria.registrarEvento("PLANO_COMERCIAL_ARQUIVADO", "PLANO_COMERCIAL", id, "Arquivou um plano comercial.");
        return Respostas.plano(gravado);
    }

    private PlanoComercial buscar(UUID id) {
        return planos.findById(id).orElseThrow(() -> new NaoEncontradoException("Plano comercial não encontrado."));
    }

    private void exigirNomeLivre(String nome, UUID ignorar) {
        if (planos.nomeEmUso(nome, ignorar)) {
            throw nomeEmUso();
        }
    }

    private static ConflictException nomeEmUso() {
        return new ConflictException("Já existe um plano comercial com este nome.", "PLANO_COMERCIAL_NOME_EM_USO");
    }

    /** A checagem prévia não pega duas gravações ao mesmo tempo: o índice parcial pega, e vira o mesmo 409. */
    private PlanoComercial gravar(PlanoComercial plano) {
        try {
            return planos.saveAndFlush(plano);
        } catch (DataIntegrityViolationException e) {
            for (Throwable t = e; t != null; t = t.getCause()) {
                if (t instanceof org.hibernate.exception.ConstraintViolationException c
                        && "ux_plano_comercial_nome".equals(c.getConstraintName())) {
                    throw nomeEmUso();
                }
            }
            throw e;
        }
    }

    private static void conferirVersao(PlanoComercial plano, Long versao) {
        if (versao == null || !versao.equals(plano.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou este plano. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }
}
