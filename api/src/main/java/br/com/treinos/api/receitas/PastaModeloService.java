package br.com.treinos.api.receitas;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.plataforma.comum.web.ConflictException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class PastaModeloService {
    public record Request(@NotBlank @Size(max = 120) String nome, Long versao) { }
    public record Response(UUID id, String nome, Long versao) { }
    private final PastaModeloRepository pastas;
    private final ReceitaRepository receitas;
    public PastaModeloService(PastaModeloRepository pastas, ReceitaRepository receitas) { this.pastas = pastas; this.receitas = receitas; }
    @Transactional(readOnly = true)
    public List<Response> listar() { return pastas.findAllByOrderByNomeAsc().stream().map(this::resposta).toList(); }
    @Transactional
    public Response criar(Request r) { return resposta(pastas.saveAndFlush(new PastaModelo(r.nome().trim()))); }
    @Transactional
    public Response alterar(UUID id, Request r) {
        PastaModelo p = buscar(id);
        if (r.versao() != null && !r.versao().equals(p.getVersao()))
            throw new ConflictException("A pasta foi alterada. Recarregue.", "CONFLITO_EDICAO");
        p.renomear(r.nome().trim()); return resposta(pastas.saveAndFlush(p));
    }
    @Transactional
    public void excluir(UUID id) {
        PastaModelo p = buscar(id);
        receitas.findAllByOrderByTipoAscOrdemAscNomeAsc().stream().filter(r -> id.equals(r.getPastaId())).forEach(r -> r.definirPasta(null));
        receitas.flush(); pastas.delete(p);
    }
    private PastaModelo buscar(UUID id) { return pastas.findById(id).orElseThrow(() -> new NaoEncontradoException("Pasta não encontrada.")); }
    private Response resposta(PastaModelo p) { return new Response(p.getId(), p.getNome(), p.getVersao()); }
}
