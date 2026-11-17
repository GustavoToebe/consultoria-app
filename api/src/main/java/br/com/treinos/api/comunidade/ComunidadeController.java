package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.*;
import br.com.treinos.api.fotos.RespostaDeFoto;
import br.com.treinos.api.security.UsuarioAutenticado;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/comunidade")
public class ComunidadeController {

    private final ComunidadeService comunidade;
    private final ApelidoDoAlunoService apelidos;
    private final FotosDoMuralService fotos;
    private final DenunciasDoMuralService denuncias;
    private final ConfiguracaoDaComunidadeService configuracao;
    private final ReacoesDoMuralService reacoes;
    private final EnquetesDoMuralService enquetes;
    private final CapasDaComunidadeService capas;
    private final ColegasDaComunidadeService colegas;
    private final LimiteTentativas limite;

    public ComunidadeController(ComunidadeService comunidade, ApelidoDoAlunoService apelidos, FotosDoMuralService fotos,
                                DenunciasDoMuralService denuncias, ConfiguracaoDaComunidadeService configuracao,
                                ReacoesDoMuralService reacoes, EnquetesDoMuralService enquetes, CapasDaComunidadeService capas,
                                ColegasDaComunidadeService colegas, LimiteTentativas limite) {
        this.reacoes = reacoes;
        this.enquetes = enquetes;
        this.capas = capas;
        this.colegas = colegas;
        this.limite = limite;
        this.comunidade = comunidade;
        this.apelidos = apelidos;
        this.fotos = fotos;
        this.denuncias = denuncias;
        this.configuracao = configuracao;
    }

    // ---- Aulões (Equipe) ----

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/aulas")
    public List<AulaResumo> listarAulas(@RequestParam(required = false) String busca) {
        return comunidade.listarAulasEquipe(busca);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/aulas")
    public AulaResumo criarAula(@RequestBody @Valid CriarAulaRequest request) {
        return comunidade.criarAula(request);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/aulas/{id}")
    public AulaResumo alterarAula(@PathVariable UUID id, @RequestBody @Valid CriarAulaRequest request) {
        return comunidade.alterarAula(id, request);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/aulas/{id}")
    public ResponseEntity<Void> excluirAula(@PathVariable UUID id) {
        comunidade.excluirAula(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/aulas/{id}/comentarios")
    public PaginaDeComentarios listarComentariosAula(@PathVariable UUID id, @RequestParam(required = false) Integer pagina,
                                                     @RequestParam(required = false) Integer tamanho,
                                                     @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.listarComentariosAula(id, eu, pagina, tamanho);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/aulas/{id}/comentarios")
    public ComentarioResponse comentarAula(@PathVariable UUID id, @RequestBody @Valid ComentarioRequest request,
                                           @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.adicionarComentarioAula(id, request.texto(), eu);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/aulas/comentarios/{id}")
    public ResponseEntity<Void> excluirComentarioAula(@PathVariable UUID id) {
        comunidade.excluirComentarioAula(id);
        return ResponseEntity.noContent().build();
    }

    // ---- Mural (Equipe / Moderação) ----

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/mural")
    public Page<MuralPostResponse> listarMural(@RequestParam(defaultValue = "0") int pagina,
                                               @RequestParam(defaultValue = "20") int tamanho,
                                               @RequestParam(required = false) String tipo,
                                               @RequestParam(required = false) String busca,
                                               @RequestParam(defaultValue = "false") boolean denunciados,
                                               @RequestParam(required = false) UUID podId,
                                               @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.listarMural(PageRequest.of(Math.max(0, pagina), Math.clamp(tamanho, 1, 50)), eu, tipo, busca, denunciados,
                podId);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/mural")
    public MuralPostResponse criarPost(@RequestBody @Valid CriarPostRequest request,
                                       @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.criarPostMural(request, eu);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/mural/{id}/fixar")
    public ResponseEntity<Void> fixarPost(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        comunidade.fixarPost(id, eu);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/mural/{id}")
    public ResponseEntity<Void> moderarPost(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        comunidade.moderarPost(id, eu);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/mural/{id}/comentarios")
    public PaginaDeComentarios listarComentariosMural(@PathVariable UUID id, @RequestParam(required = false) Integer pagina,
                                                      @RequestParam(required = false) Integer tamanho,
                                                      @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.listarComentariosMural(id, eu, pagina, tamanho);
    }

    /** A equipe responde no mural (C6): o comentário sai com {@code daEquipe} e, na dúvida, vem primeiro. */
    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/mural/{id}/comentarios")
    public ComentarioResponse comentarMural(@PathVariable UUID id, @RequestBody @Valid ComentarioRequest request,
                                            @AuthenticationPrincipal UsuarioAutenticado eu) {
        return comunidade.adicionarComentarioMural(id, request.texto(), eu);
    }

    /** Bytes da foto de um post (a pendente ainda é só do aluno); sempre {@code no-store}. */
    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/mural/fotos/{id}")
    public ResponseEntity<byte[]> fotoDoPost(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        return RespostaDeFoto.de(fotos.lerDaEquipe(id, eu));
    }

    /** Dispensa as denúncias do post (apaga todas); o post continua. Remover o post é o {@code DELETE /mural/{id}}. */
    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping("/mural/{id}/denuncias/dispensar")
    public ResponseEntity<Void> dispensarDenuncias(@PathVariable UUID id) {
        denuncias.dispensar(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/mural/comentarios/{id}")
    public ResponseEntity<Void> moderarComentarioMural(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        comunidade.moderarComentarioMural(id, eu);
        return ResponseEntity.noContent().build();
    }

    // ---- Reações e enquetes ----

    /** A equipe reage (D4): só conta, sem identidade; idempotente (204). Código fora da lista = 422 {@code REACAO_INVALIDA}. */
    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/mural/{id}/reacoes/{codigo}")
    public ResponseEntity<Void> reagir(@PathVariable UUID id, @PathVariable String codigo, @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.comunidade(eu.usuarioId());
        reacoes.reagir(id, codigo, eu);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/mural/{id}/reacoes/{codigo}")
    public ResponseEntity<Void> desfazerReacao(@PathVariable UUID id, @PathVariable String codigo,
                                               @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.comunidade(eu.usuarioId());
        reacoes.desfazer(id, codigo, eu);
        return ResponseEntity.noContent().build();
    }

    /** A equipe também vota (substitui o próprio conjunto de opções; devolve a enquete como o mural a mostra). */
    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @PutMapping("/mural/{id}/votos")
    public EnqueteResponse votar(@PathVariable UUID id, @RequestBody @Valid VotoRequest request,
                                 @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.comunidade(eu.usuarioId());
        return enquetes.votar(id, request.opcaoIds(), eu);
    }

    /** "Mostrar votos": balde próprio da equipe, contado antes de qualquer checagem. */
    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/mural/{id}/votos")
    public VotosDaEnquete votos(@PathVariable UUID id, @RequestParam(required = false) UUID opcaoId,
                                @RequestParam(required = false) Integer pagina, @RequestParam(required = false) Integer tamanho,
                                @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.votosDaEquipe(eu.usuarioId());
        return enquetes.votos(id, opcaoId, pagina, tamanho, eu);
    }

    /**
     * Foto de um votante aluno, com a mesma regra e o mesmo 404 sem distinção da rota do aluno (perfil reservado, sem foto,
     * equipe, inativo, outra consultoria). Balde próprio, contado antes de qualquer checagem; {@code no-store}.
     */
    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/perfis/{autorId}/foto")
    public ResponseEntity<byte[]> fotoDoVotante(@PathVariable UUID autorId, @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.fotoDaEquipe(eu.usuarioId());
        return RespostaDeFoto.de(colegas.foto(autorId, eu));
    }

    // ---- Capas do vídeo (Equipe) ----

    /** Capa pendente (JPEG regravado sem metadados); o id vai em {@code capaId} do aulão ou do post de vídeo. */
    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PostMapping(value = "/capas", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CapaCriada enviarCapa(@RequestPart("arquivo") MultipartFile arquivo, @AuthenticationPrincipal UsuarioAutenticado eu) {
        limite.comunidade(eu.usuarioId());
        try {
            return new CapaCriada(capas.enviar(arquivo.getBytes()));
        } catch (IOException e) {
            throw new BadRequestException("Não foi possível ler o arquivo enviado.");
        }
    }

    /** Bytes da capa (a pendente também, para a prévia); sempre {@code no-store}. */
    @PreAuthorize("hasAuthority('PERM_TREINO_LER')")
    @GetMapping("/capas/{id}")
    public ResponseEntity<byte[]> capa(@PathVariable UUID id, @AuthenticationPrincipal UsuarioAutenticado eu) {
        return RespostaDeFoto.de(capas.lerDaEquipe(id, eu));
    }

    // ---- Chaves da comunidade ----

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @GetMapping("/configuracao")
    public ConfiguracaoResponse configuracao(@AuthenticationPrincipal UsuarioAutenticado eu) {
        return configuracao.obter(eu);
    }

    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @PutMapping("/configuracao")
    public ConfiguracaoResponse alterarConfiguracao(@RequestBody @Valid ConfiguracaoRequest request,
                                                    @AuthenticationPrincipal UsuarioAutenticado eu) {
        return configuracao.alterar(eu, request);
    }

    /** Limpa o apelido de um aluno (o aluno pode pôr outro depois). {@code autorId} é o id de usuário do mural; idempotente. */
    @PreAuthorize("hasAuthority('PERM_COMUNIDADE_MODERAR')")
    @DeleteMapping("/perfis/{autorId}/apelido")
    public ResponseEntity<Void> removerApelido(@PathVariable UUID autorId) {
        apelidos.remover(autorId);
        return ResponseEntity.noContent().build();
    }
}
