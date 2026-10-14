package br.com.treinos.api.biblioteca;

import br.com.treinos.api.biblioteca.dto.SuplementoDtos.SuplementoRequest;
import br.com.treinos.api.biblioteca.dto.SuplementoDtos.SuplementoResponse;
import br.com.treinos.api.web.Buscas;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.web.LinksExternos;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/** Suplementos da biblioteca da consultoria. Tudo já isolado pelo {@code @TenantId}; registro de outra consultoria dá 404. */
@Service
public class SuplementoService {

    private static final UUID NENHUM = new UUID(0L, 0L);
    private static final TypeReference<List<String>> TEXTOS = new TypeReference<>() { };

    private final SuplementoRepository suplementos;
    private final JsonMapper json;

    public SuplementoService(SuplementoRepository suplementos, JsonMapper json) {
        this.suplementos = suplementos;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<SuplementoResponse> listar(String busca, String categoria) {
        String filtro = categoria == null ? "" : categoria.trim();
        return suplementos.buscarAtivos(Buscas.padraoSemAcento(busca), filtro).stream().map(this::resposta).toList();
    }

    @Transactional
    public SuplementoResponse criar(SuplementoRequest r) {
        Suplemento.Valores valores = valores(r);
        exigirNomeLivre(valores.nomeBusca(), NENHUM);
        return resposta(suplementos.saveAndFlush(new Suplemento(valores)));
    }

    @Transactional
    public SuplementoResponse alterar(UUID id, SuplementoRequest r) {
        Suplemento s = ativo(id);
        Suplemento.Valores valores = valores(r);
        exigirNomeLivre(valores.nomeBusca(), id);
        s.alterar(valores);
        return resposta(suplementos.saveAndFlush(s));
    }

    @Transactional
    public void inativar(UUID id) {
        ativo(id).inativar();
    }

    private Suplemento.Valores valores(SuplementoRequest r) {
        String nome = r.nome().trim();
        List<String> sabores = r.sabores() == null ? List.of() : List.copyOf(new LinkedHashSet<>(r.sabores().stream()
                .map(Buscas::opcional).filter(s -> s != null).toList()));
        return new Suplemento.Valores(nome, Buscas.semAcento(nome), Buscas.opcional(r.marca()),
                Buscas.opcional(r.categoria()), Buscas.opcional(r.porcao()), Buscas.opcional(r.porcoesPorEmbalagem()),
                json.writeValueAsString(sabores), LinksExternos.normalizar(r.link()));
    }

    private SuplementoResponse resposta(Suplemento s) {
        return new SuplementoResponse(s.getId(), s.getNome(), s.getMarca(), s.getCategoria(), s.getPorcao(),
                s.getPorcoesPorEmbalagem(), json.readValue(s.getSabores(), TEXTOS), s.getLink());
    }

    private Suplemento ativo(UUID id) {
        return suplementos.findById(id).filter(Suplemento::isAtivo)
                .orElseThrow(() -> new NaoEncontradoException("Suplemento não encontrado."));
    }

    private void exigirNomeLivre(String nomeBusca, UUID exceto) {
        if (suplementos.existeNomeAtivo(nomeBusca, exceto)) {
            throw new ConflictException("Já existe um suplemento com este nome.", "NOME_EM_USO");
        }
    }
}
