package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.ErgogenicoDtos.ErgogenicoRequest;
import br.com.treinos.api.biblioteca.dto.ErgogenicoDtos.ErgogenicoResponse;
import br.com.treinos.api.web.Buscas;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Medicação e ergogênicos da biblioteca da consultoria. Tudo já isolado pelo {@code @TenantId}; registro de outra
 * consultoria dá 404. As permissões {@code ERGOGENICO_*} ficam na rota. Nada aqui vai para log nem para auditoria.
 */
@Service
public class ErgogenicoService {

    private static final UUID NENHUM = new UUID(0L, 0L);

    private final ErgogenicoRepository ergogenicos;

    public ErgogenicoService(ErgogenicoRepository ergogenicos) {
        this.ergogenicos = ergogenicos;
    }

    @Transactional(readOnly = true)
    public List<ErgogenicoResponse> listar(String busca, CategoriaErgogenico categoria) {
        return ergogenicos.buscarAtivos(Buscas.padraoSemAcento(busca), categoria == null ? "" : categoria.name())
                .stream().map(ErgogenicoService::resposta).toList();
    }

    @Transactional
    public ErgogenicoResponse criar(ErgogenicoRequest r) {
        Ergogenico.Valores valores = valores(r);
        exigirLivre(valores, NENHUM);
        return resposta(ergogenicos.saveAndFlush(new Ergogenico(valores)));
    }

    @Transactional
    public ErgogenicoResponse alterar(UUID id, ErgogenicoRequest r) {
        Ergogenico e = ativo(id);
        Ergogenico.Valores valores = valores(r);
        exigirLivre(valores, id);
        e.alterar(valores);
        return resposta(ergogenicos.saveAndFlush(e));
    }

    @Transactional
    public void inativar(UUID id) {
        ativo(id).inativar();
    }

    private static Ergogenico.Valores valores(ErgogenicoRequest r) {
        String nome = r.nome().trim();
        String principio = Buscas.opcional(r.principioAtivo());
        return new Ergogenico.Valores(r.categoria(), nome, Buscas.semAcento(nome), principio,
                Buscas.semAcento(principio), Buscas.opcional(r.concentracao()), Buscas.opcional(r.apresentacao()),
                Buscas.opcional(r.observacao()));
    }

    private static ErgogenicoResponse resposta(Ergogenico e) {
        return new ErgogenicoResponse(e.getId(), CategoriaErgogenico.valueOf(e.getCategoria()), e.getNome(),
                e.getPrincipioAtivo(), e.getConcentracao(), e.getApresentacao(), e.getObservacao());
    }

    private Ergogenico ativo(UUID id) {
        return ergogenicos.findById(id).filter(Ergogenico::isAtivo)
                .orElseThrow(() -> new NaoEncontradoException("Item não encontrado."));
    }

    private void exigirLivre(Ergogenico.Valores v, UUID exceto) {
        if (ergogenicos.existeIgual(v.nomeBusca(), vazioSeNulo(v.concentracao()), vazioSeNulo(v.apresentacao()), exceto)) {
            throw new ConflictException("Já existe um item com este nome, concentração e apresentação.", "NOME_EM_USO");
        }
    }

    private static String vazioSeNulo(String texto) {
        return texto == null ? "" : texto;
    }
}
